import type { CityRef } from '../city/city-ref';
import { dedupeCities } from '../city/city-ref';
import type { GeoPoint } from '../geo/geo-point';
import type { Photo } from '../photo/photo';
import { effectiveOffset, toLocalDayRange, type TimeRange } from '../common/time';

export interface PhotoSummary {
  readonly timeRange: TimeRange;
  readonly cityRefs: readonly CityRef[];
  readonly locationMissingCount: number;
  readonly confidence: 'high' | 'low';
}

export type CityLookup = (geo: GeoPoint) => CityRef | null;

export function sortByCapture(photos: readonly Photo[]): Photo[] {
  return photos.slice().sort((a, b) => (a.capturedAt === b.capturedAt ? a.id.localeCompare(b.id) : a.capturedAt - b.capturedAt));
}

/** Derives the candidate-level facts that must stay consistent with the photo set. */
export function summarizePhotos(
  photos: readonly Photo[],
  resolveCity: CityLookup,
  defaultOffsetMinutes: number,
): PhotoSummary {
  const sorted = sortByCapture(photos);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) {
    throw new Error('summarizePhotos requires at least one photo');
  }
  const cities: CityRef[] = [];
  let located = 0;
  for (const photo of sorted) {
    if (!photo.geo) continue;
    located += 1;
    const city = resolveCity(photo.geo);
    if (city) cities.push(city);
  }
  const missing = sorted.length - located;
  const ratio = located / sorted.length;
  const confidence = sorted.length >= 8 && ratio >= 0.7 ? 'high' : 'low';
  return {
    timeRange: toLocalDayRange(
      first.capturedAt,
      last.capturedAt,
      effectiveOffset(first.captureOffsetMinutes, defaultOffsetMinutes),
      effectiveOffset(last.captureOffsetMinutes, defaultOffsetMinutes),
    ),
    cityRefs: dedupeCities(cities),
    locationMissingCount: missing,
    confidence,
  };
}
