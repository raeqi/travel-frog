import type { TripId, VisitId } from '../common/ids';
import { HOUR_MS, effectiveOffset, localDayKey, type Instant } from '../common/time';
import { centroidOf, haversineKm, makeGeoPoint, type GeoPoint } from '../geo/geo-point';
import { makeCityRef, unknownCity, type CityRef } from '../city/city-ref';
import { ok, type Result } from '../common/result';
import { createVisit, visitRange, type Visit } from '../visit/visit';
import type { Photo } from '../photo/photo';
import type { CityLookup } from '../candidate/summarize';
import type { SplitConfig } from './split-trips';

interface Group {
  photos: Photo[];
  city: CityRef;
}

export interface VisitResolution {
  readonly visits: readonly Visit[];
  readonly photoVisitIds: ReadonlyMap<string, VisitId>;
}

export interface ResolveVisitsInput {
  readonly tripId: TripId;
  readonly photos: readonly Photo[];
  readonly config: SplitConfig;
  readonly resolveCity: CityLookup;
  readonly defaultOffsetMinutes: number;
  readonly now: Instant;
}

function cityFor(photo: Photo, lookup: CityLookup): CityRef {
  if (photo.geo) {
    const city = lookup(photo.geo);
    if (city) return city;
    return unknownCity(photo.geo);
  }
  return unknownCity(null);
}

function locationSourcePriority(photos: readonly Photo[]): Visit['locationSource'] {
  if (photos.some((photo) => photo.locationSource === 'manual')) return 'manual';
  if (photos.some((photo) => photo.locationSource === 'exif')) return 'exif';
  if (photos.some((photo) => photo.locationSource === 'candidate')) return 'candidate';
  return 'none';
}

/**
 * Groups geotagged photos of a trip into visits. Photos without GPS never join a visit;
 * they stay at trip level so the gap list can pick them up.
 */
export function resolveVisits(input: ResolveVisitsInput): Result<VisitResolution> {
  const located = input.photos
    .filter((photo) => photo.tripId === input.tripId && photo.geo !== null && !photo.ignored)
    .sort((a, b) => (a.capturedAt === b.capturedAt ? a.id.localeCompare(b.id) : a.capturedAt - b.capturedAt));

  const groups: Group[] = [];
  let current: Group | null = null;
  let centroid: { lat: number; lng: number } | null = null;
  let currentCity: CityRef | null = null;

  for (const photo of located) {
    const geo = photo.geo;
    if (!geo) continue;
    const city = cityFor(photo, input.resolveCity);
    const prev = current?.photos[current.photos.length - 1];

    if (current && prev && centroid && currentCity) {
      const gapOk = photo.capturedAt - prev.capturedAt > input.config.visitGapHours * HOUR_MS;
      const moved = haversineKm(centroid, geo) > input.config.visitRadiusKm;
      const cityChanged = city.key !== currentCity.key;
      if (gapOk || moved || cityChanged) {
        groups.push(current);
        current = null;
        centroid = null;
        currentCity = null;
      }
    }

    if (!current) {
      current = { photos: [photo], city };
      centroid = { lat: geo.lat, lng: geo.lng };
      currentCity = city;
      continue;
    }
    current.photos.push(photo);
    const nextCentroid = centroidOf(current.photos.map((item) => item.geo as GeoPoint));
    centroid = nextCentroid;
    // The centroid may fall into another city as members accumulate; keep the first city key stable.
  }
  if (current) groups.push(current);

  const visits: Visit[] = [];
  const photoVisitIds = new Map<string, VisitId>();
  const nameCounts = new Map<string, number>();

  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index];
    if (!group) continue;
    const first = group.photos[0];
    const last = group.photos[group.photos.length - 1];
    if (!first || !last) continue;
    const mean = centroidOf(group.photos.map((photo) => photo.geo as GeoPoint));
    if (!mean) continue;
    const priority = locationSourcePriority(group.photos);
    const source = priority === 'none' ? 'candidate' : priority;
    const visitGeo = makeGeoPoint({
      lat: mean.lat,
      lng: mean.lng,
      source,
      approximate: group.photos.length > 1 || group.photos.some((photo) => photo.geo?.approximate === true),
    });
    if (!visitGeo.ok) return visitGeo;

    const baseName = group.city.name;
    const seen = (nameCounts.get(baseName) ?? 0) + 1;
    nameCounts.set(baseName, seen);
    const displayName = seen === 1 ? baseName : `${baseName}（${seen}）`;

    const dayKeys = new Set(group.photos.map((photo) => localDayKey(photo.capturedAt, effectiveOffset(photo.captureOffsetMinutes, input.defaultOffsetMinutes))));
    const confidence: Visit['confidence'] = group.photos.length >= 3 ? 'high' : dayKeys.size > 1 ? 'low' : 'medium';

    const visit = createVisit({
      id: `visit_${input.tripId}_${index}_${first.id}`,
      tripId: input.tripId,
      sequence: index,
      cityRef: group.city,
      displayName,
      timeRange: visitRange(first.capturedAt, last.capturedAt),
      geo: visitGeo.value,
      locationSource: visitGeo.value.source,
      confidence,
    });
    if (!visit.ok) return visit;
    visits.push(visit.value);
    for (const photo of group.photos) photoVisitIds.set(photo.id, visit.value.id);
  }

  return ok({ visits, photoVisitIds });
}

/** Builds a city reference from a user-picked city name, keeping the real centroid. */
export function manualCity(input: {
  name: string;
  countryCode: string;
  countryName: string;
  geo: GeoPoint | null;
}): CityRef {
  return makeCityRef({
    name: input.name,
    countryCode: input.countryCode || 'XXX',
    countryName: input.countryName || '未知',
    centroid: input.geo,
    source: 'manual',
    confidence: 'high',
  });
}
