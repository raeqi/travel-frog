import type { CityRef } from '../city/city-ref';
import { unknownCity } from '../city/city-ref';
import { centroidOf, makeGeoPoint, type GeoPoint } from '../geo/geo-point';
import { effectiveOffset, localDayKey, HOUR_MS } from '../common/time';
import type { Photo } from '../photo/photo';
import type { CityLookup } from '../candidate/summarize';
import type { SplitConfig } from './split-trips';

export type FillReason = 'same-day-gps' | 'nearest-in-time';

export interface LocationSuggestion {
  readonly photoId: string;
  readonly geo: GeoPoint;
  readonly cityRef: CityRef;
  readonly reason: FillReason;
  readonly sourcePhotoIds: readonly string[];
  readonly timeDeltaMs: number;
  readonly distanceKm: number;
  readonly confidence: 'high' | 'medium' | 'low';
}

export interface SuggestInput {
  readonly photos: readonly Photo[];
  readonly config: SplitConfig;
  readonly resolveCity: CityLookup;
  readonly defaultOffsetMinutes: number;
}

interface DayGroup {
  dayKey: string;
  visitId: string | null;
  city: CityRef;
  centroid: { lat: number; lng: number };
  members: Photo[];
  timeRange: { start: number; end: number };
}

/**
 * Produces at most one suggestion per unlocated photo, fully explainable by source photos.
 * Never writes anything: the user confirms each batch explicitly.
 */
export function suggestLocations(input: SuggestInput): LocationSuggestion[] {
  const located = input.photos.filter((photo) => photo.geo !== null && !photo.ignored);
  const targets = input.photos
    .filter((photo) => photo.geo === null && !photo.ignored && photo.capturedAtSource !== 'missing')
    .sort((a, b) => a.capturedAt - b.capturedAt);

  if (located.length === 0) return [];

  const groupsByDay = new Map<string, DayGroup[]>();
  for (const photo of located) {
    const geo = photo.geo;
    if (!geo) continue;
    const offset = effectiveOffset(photo.captureOffsetMinutes, input.defaultOffsetMinutes);
    const dayKey = localDayKey(photo.capturedAt, offset);
    const city = input.resolveCity(geo) ?? unknownCity(geo);
    const bucket = groupsByDay.get(dayKey) ?? [];
    const visitKey = photo.visitId ?? city.key;
    let group = bucket.find((item) => (item.visitId ?? item.city.key) === visitKey);
    if (!group) {
      group = {
        dayKey,
        visitId: photo.visitId,
        city,
        centroid: { lat: geo.lat, lng: geo.lng },
        members: [photo],
        timeRange: { start: photo.capturedAt, end: photo.capturedAt },
      };
      bucket.push(group);
      groupsByDay.set(dayKey, bucket);
    } else {
      group.members.push(photo);
      const centroid = centroidOf(group.members.map((item) => item.geo as GeoPoint));
      if (centroid) group.centroid = centroid;
      group.timeRange.start = Math.min(group.timeRange.start, photo.capturedAt);
      group.timeRange.end = Math.max(group.timeRange.end, photo.capturedAt);
    }
  }

  const suggestions: LocationSuggestion[] = [];
  for (const target of targets) {
    const offset = effectiveOffset(target.captureOffsetMinutes, input.defaultOffsetMinutes);
    const dayKey = localDayKey(target.capturedAt, offset);
    const sameDay = groupsByDay.get(dayKey) ?? [];
    let best: { group: DayGroup; delta: number } | null = null;
    for (const group of sameDay) {
      const delta = target.capturedAt < group.timeRange.start
        ? group.timeRange.start - target.capturedAt
        : target.capturedAt > group.timeRange.end
          ? target.capturedAt - group.timeRange.end
          : 0;
      if (!best || delta < best.delta) best = { group, delta };
    }

    if (best) {
      const anchor = best.group.members.slice().sort((a, b) => {
        const da = Math.abs(a.capturedAt - target.capturedAt);
        const db = Math.abs(b.capturedAt - target.capturedAt);
        return da - db;
      })[0];
      const geo = makeGeoPoint({
        lat: best.group.centroid.lat,
        lng: best.group.centroid.lng,
        source: 'candidate',
        approximate: true,
      });
      if (!geo.ok) continue;
      suggestions.push({
        photoId: target.id,
        geo: geo.value,
        cityRef: best.group.city,
        reason: 'same-day-gps',
        sourcePhotoIds: anchor ? [anchor.id] : [],
        timeDeltaMs: best.delta,
        distanceKm: 0,
        confidence: best.group.visitId !== null && target.visitId === best.group.visitId ? 'high' : 'medium',
      });
      continue;
    }

    let nearest: { photo: Photo; delta: number } | null = null;
    for (const photo of located) {
      const delta = Math.abs(photo.capturedAt - target.capturedAt);
      if (!nearest || delta < nearest.delta) nearest = { photo, delta };
    }
    if (!nearest) continue;
    if (nearest.delta > input.config.maxFillGapHours * HOUR_MS) continue;
    const sourceGeo = nearest.photo.geo;
    if (!sourceGeo) continue;
    const geo = makeGeoPoint({
      lat: sourceGeo.lat,
      lng: sourceGeo.lng,
      source: 'candidate',
      approximate: true,
    });
    if (!geo.ok) continue;
    suggestions.push({
      photoId: target.id,
      geo: geo.value,
      cityRef: input.resolveCity(sourceGeo) ?? unknownCity(sourceGeo),
      reason: 'nearest-in-time',
      sourcePhotoIds: [nearest.photo.id],
      timeDeltaMs: nearest.delta,
      distanceKm: 0,
      confidence: 'low',
    });
  }

  return suggestions;
}
