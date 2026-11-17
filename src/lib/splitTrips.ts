import type { Candidate, Photo, SplitConfig } from '../types';
import { haversineKm, placeLabel } from './geo';

export const DEFAULT_CONFIG: SplitConfig = {
  maxGapHours: 30,
  maxDistanceKm: 200,
  farPlaceHours: 8,
  maxTripDays: 21,
  visitRadiusKm: 4,
  visitGapHours: 6,
};

const HOUR = 3600_000;
const DAY = 86_400_000;

export interface GeoPhoto {
  id: string;
  takenAt: number;
  lat?: number;
  lng?: number;
}

const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/**
 * Segments photos into candidate trips using three signals:
 *  - time adjacency (maxGapHours),
 *  - geographic proximity (maxDistanceKm, only after farPlaceHours),
 *  - continuous days (maxTripDays).
 * Photos without GPS still participate in the time and day rules.
 */
export function splitPhotosIntoTrips<T extends GeoPhoto>(
  photos: T[],
  config: SplitConfig = DEFAULT_CONFIG,
): T[][] {
  const sorted = photos
    .filter((p) => Number.isFinite(p.takenAt))
    .slice()
    .sort((a, b) => a.takenAt - b.takenAt);

  const groups: T[][] = [];
  let current: T[] = [];

  for (const photo of sorted) {
    if (!current.length) {
      current = [photo];
      continue;
    }
    const prev = current[current.length - 1];
    const gapHours = (photo.takenAt - prev.takenAt) / HOUR;
    let shouldSplit = gapHours > config.maxGapHours;

    if (!shouldSplit) {
      // Compare against the previous geotagged photo: a long hop after a long silence
      // means "another trip", not "a day out".
      for (let i = current.length - 1; i >= 0; i -= 1) {
        const ref = current[i];
        if (ref.lat == null || ref.lng == null) continue;
        if (photo.lat != null && photo.lng != null) {
          const distance = haversineKm(ref.lat, ref.lng, photo.lat, photo.lng);
          const sinceRefHours = (photo.takenAt - ref.takenAt) / HOUR;
          if (distance > config.maxDistanceKm && sinceRefHours >= config.farPlaceHours) {
            shouldSplit = true;
          }
        }
        break;
      }
    }

    if (!shouldSplit) {
      const spanDays = Math.round((startOfDay(photo.takenAt) - startOfDay(current[0].takenAt)) / DAY);
      if (spanDays >= config.maxTripDays) {
        shouldSplit = true;
      }
    }

    if (shouldSplit) {
      groups.push(current);
      current = [photo];
    } else {
      current.push(photo);
    }
  }
  if (current.length) groups.push(current);
  return groups;
}

export function candidateIdFor(ids: string[]): string {
  const sorted = ids.slice().sort();
  return `cand-${sorted[0] ?? 'empty'}-${sorted[sorted.length - 1] ?? 'empty'}`;
}

export function buildCandidate(
  photoIds: string[],
  photos: Record<string, Photo>,
  id = candidateIdFor(photoIds),
): Candidate {
  const list = photoIds
    .map((pid) => photos[pid])
    .filter((p): p is Photo => Boolean(p))
    .sort((a, b) => a.takenAt - b.takenAt);

  const cityNames: string[] = [];
  let locationMissing = 0;
  for (const p of list) {
    if (p.lat == null || p.lng == null) {
      locationMissing += 1;
      continue;
    }
    const label = placeLabel(p.lat, p.lng, p.placeLabel);
    if (label && !cityNames.includes(label)) cityNames.push(label);
  }

  return {
    id,
    startAt: list[0]?.takenAt ?? 0,
    endAt: list[list.length - 1]?.takenAt ?? 0,
    photoIds: list.map((p) => p.id),
    cityNames: cityNames.length ? cityNames : ['未识别地点'],
    locationMissing,
    status: 'pending',
  };
}

export function mergeCandidates(
  a: Candidate,
  b: Candidate,
  photos: Record<string, Photo>,
): Candidate {
  const ids = Array.from(new Set([...a.photoIds, ...b.photoIds]));
  const ordered = ids
    .map((id) => photos[id])
    .filter((p): p is Photo => Boolean(p))
    .sort((x, y) => x.takenAt - y.takenAt)
    .map((p) => p.id);
  const merged = buildCandidate(ordered, photos, candidateIdFor(ordered));
  return { ...merged, status: 'pending' };
}

/** Split a candidate at a timestamp (usually the start of a day). */
export function splitCandidate(
  candidate: Candidate,
  at: number,
  photos: Record<string, Photo>,
): [Candidate, Candidate] | null {
  const list = candidate.photoIds
    .map((id) => photos[id])
    .filter((p): p is Photo => Boolean(p))
    .sort((a, b) => a.takenAt - b.takenAt);

  const left = list.filter((p) => p.takenAt < at).map((p) => p.id);
  const right = list.filter((p) => p.takenAt >= at).map((p) => p.id);
  if (!left.length || !right.length) return null;

  const a = buildCandidate(left, photos, `${candidate.id}-a`);
  const b = buildCandidate(right, photos, `${candidate.id}-b`);
  return [a, b];
}

export function candidatesFromPhotos(
  photos: Photo[],
  config: SplitConfig,
): Candidate[] {
  const byId = Object.fromEntries(photos.map((p) => [p.id, p]));
  return splitPhotosIntoTrips(photos, config)
    .map((group) => buildCandidate(group.map((p) => p.id), byId))
    .sort((a, b) => b.startAt - a.startAt);
}
