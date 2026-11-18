import type { CityRef } from '../city/city-ref';
import { domainError, err, ok, type Result } from '../common/result';
import { HOUR_MS, contains, localDayDiff, effectiveOffset, type Instant, type TimeRange } from '../common/time';
import type { GeoPoint } from '../geo/geo-point';
import { haversineKm } from '../geo/geo-point';
import type { Photo } from '../photo/photo';
import type { SplitReason } from '../candidate/candidate';
import { summarizePhotos, sortByCapture, type CityLookup } from '../candidate/summarize';
import type { Trip } from '../trip/trip';
import type { PhotoId } from '../common/ids';

export interface SplitConfig {
  readonly maxGapHours: number;
  readonly maxDistanceKm: number;
  readonly farPlaceHours: number;
  readonly maxTripDays: number;
  readonly visitRadiusKm: number;
  readonly visitGapHours: number;
  readonly maxFillGapHours: number;
  readonly minPhotosPerCandidate: number;
}

export const DEFAULT_SPLIT_CONFIG: SplitConfig = {
  maxGapHours: 30,
  maxDistanceKm: 200,
  farPlaceHours: 8,
  maxTripDays: 21,
  visitRadiusKm: 4,
  visitGapHours: 6,
  maxFillGapHours: 72,
  minPhotosPerCandidate: 1,
};

const RANGES: Readonly<Record<keyof SplitConfig, readonly [number, number]>> = {
  maxGapHours: [2, 240],
  maxDistanceKm: [10, 5000],
  farPlaceHours: [1, 72],
  maxTripDays: [1, 90],
  visitRadiusKm: [0.5, 100],
  visitGapHours: [1, 48],
  maxFillGapHours: [1, 720],
  minPhotosPerCandidate: [1, 50],
};

export function validateSplitConfig(config: SplitConfig): Result<SplitConfig> {
  for (const key of Object.keys(RANGES) as (keyof SplitConfig)[]) {
    const value = config[key];
    const [min, max] = RANGES[key];
    if (!Number.isFinite(value) || value < min || value > max) {
      return err(domainError('CONFIG_INVALID', `配置 ${key} 必须在 ${min}–${max} 之间`, { key }));
    }
  }
  return ok(config);
}

export interface CandidateDraft {
  readonly photoIds: readonly PhotoId[];
  readonly timeRange: TimeRange;
  readonly cityRefs: readonly CityRef[];
  readonly locationMissingCount: number;
  readonly splitReasons: readonly SplitReason[];
  readonly confidence: 'high' | 'low';
}

export type ExcludedReason = 'invalid-time' | 'missing-time' | 'future-clock' | 'ignored' | 'assigned';

export interface SplitOutcome {
  readonly candidates: readonly CandidateDraft[];
  readonly excluded: readonly { photoId: PhotoId; reason: ExcludedReason }[];
  readonly conflicts: readonly { photoId: PhotoId; tripId: string }[];
  readonly reasonCounts: Readonly<Record<SplitReason, number>>;
  readonly assignedPhotoIds: readonly PhotoId[];
}

export interface SplitInput {
  readonly photos: readonly Photo[];
  readonly config: SplitConfig;
  readonly existingTrips: readonly Trip[];
  readonly defaultOffsetMinutes: number;
  readonly now: Instant;
  readonly resolveCity: CityLookup;
}

interface Segment {
  photos: Photo[];
  reasons: Set<SplitReason>;
}

export function splitPhotosIntoTrips(input: SplitInput): Result<SplitOutcome> {
  const configCheck = validateSplitConfig(input.config);
  if (!configCheck.ok) return configCheck;

  const excluded: { photoId: PhotoId; reason: ExcludedReason }[] = [];
  const usable: Photo[] = [];
  const seen = new Set<string>();

  for (const photo of input.photos) {
    if (seen.has(photo.id)) {
      return err(domainError('DUPLICATE_ID', '输入照片 ID 重复', { id: photo.id }));
    }
    seen.add(photo.id);
    if (photo.tripId !== null) {
      excluded.push({ photoId: photo.id, reason: 'assigned' });
      continue;
    }
    if (photo.ignored) {
      excluded.push({ photoId: photo.id, reason: 'ignored' });
      continue;
    }
    if (photo.capturedAtSource === 'missing' || !Number.isFinite(photo.capturedAt)) {
      excluded.push({ photoId: photo.id, reason: 'missing-time' });
      continue;
    }
    if (photo.capturedAt - input.now > 24 * HOUR_MS) {
      excluded.push({ photoId: photo.id, reason: 'future-clock' });
      continue;
    }
    usable.push(photo);
  }

  const sorted = sortByCapture(usable);
  const segments: Segment[] = [];
  let current: Segment | null = null;
  let lastGeo: GeoPoint | null = null;

  for (const photo of sorted) {
    if (!current) {
      current = { photos: [photo], reasons: new Set<SplitReason>(['manual']) };
      lastGeo = photo.geo;
      continue;
    }
    const prev = current.photos[current.photos.length - 1];
    if (!prev) continue;
    const reasons = new Set<SplitReason>();

    const gap = photo.capturedAt - prev.capturedAt;
    if (gap > input.config.maxGapHours * HOUR_MS) reasons.add('time-gap');

    if (lastGeo && photo.geo) {
      const distance = haversineKm(lastGeo, photo.geo);
      if (distance > input.config.maxDistanceKm && gap >= input.config.farPlaceHours * HOUR_MS) {
        reasons.add('far-place');
      }
    }

    const segmentStart = current.photos[0];
    if (segmentStart) {
      const offset = effectiveOffset(photo.captureOffsetMinutes, input.defaultOffsetMinutes);
      const firstOfDay = localDayDiff(photo.capturedAt, prev.capturedAt, offset) > 0;
      if (firstOfDay) {
        const span = localDayDiff(photo.capturedAt, segmentStart.capturedAt, offset);
        if (span >= input.config.maxTripDays) reasons.add('max-days');
      }
    }

    if (reasons.size > 0) {
      segments.push(current);
      current = { photos: [photo], reasons: new Set<SplitReason>(['manual']) };
    } else {
      current.photos.push(photo);
    }
    if (photo.geo) lastGeo = photo.geo;
  }
  if (current) segments.push(current);

  const candidates: CandidateDraft[] = [];
  const conflicts: { photoId: PhotoId; tripId: string }[] = [];
  const reasonCounts: Record<SplitReason, number> = { 'time-gap': 0, 'far-place': 0, 'max-days': 0, manual: 0 };
  const assignedPhotoIds: PhotoId[] = [];

  for (const segment of segments) {
    const summary = summarizePhotos(segment.photos, input.resolveCity, input.defaultOffsetMinutes);
    const reasons: SplitReason[] = segment.reasons.size > 0 ? Array.from(segment.reasons) : ['manual'];
    for (const reason of reasons) reasonCounts[reason] += 1;
    candidates.push({
      photoIds: segment.photos.map((photo) => photo.id),
      timeRange: summary.timeRange,
      cityRefs: summary.cityRefs,
      locationMissingCount: summary.locationMissingCount,
      splitReasons: reasons,
      confidence: summary.confidence,
    });
    for (const photo of segment.photos) {
      assignedPhotoIds.push(photo.id);
      for (const trip of input.existingTrips) {
        if (contains(trip.timeRange, photo.capturedAt)) {
          conflicts.push({ photoId: photo.id, tripId: trip.id });
          break;
        }
      }
    }
  }

  return ok({ candidates, excluded, conflicts, reasonCounts, assignedPhotoIds });
}

/** Deterministic candidate id: same input photos always yield the same id. */
export function candidateIdFor(first: PhotoId, last: PhotoId): string {
  return `cand_${first}__${last}`;
}
