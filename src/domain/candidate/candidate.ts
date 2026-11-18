import type { CandidateId, ImportBatchId, TripId } from '../common/ids';
import type { CityRef } from '../city/city-ref';
import { domainError, err, ok, type Result } from '../common/result';
import { DAY_MS, makeTimeRange, type Instant, type TimeRange } from '../common/time';
import type { DataOrigin, Photo } from '../photo/photo';
import { summarizePhotos, type CityLookup } from './summarize';

export type CandidateStatus = 'pending' | 'ignored' | 'confirmed' | 'merged' | 'split';
export type SplitReason = 'time-gap' | 'far-place' | 'max-days' | 'manual';

export interface Candidate {
  readonly id: CandidateId;
  readonly importBatchId: ImportBatchId;
  readonly timeRange: TimeRange;
  readonly photoIds: readonly string[];
  readonly cityRefs: readonly CityRef[];
  readonly locationMissingCount: number;
  readonly splitReasons: readonly SplitReason[];
  readonly confidence: 'high' | 'low';
  readonly status: CandidateStatus;
  readonly derivedFrom: readonly CandidateId[];
  readonly supersededBy: readonly CandidateId[];
  readonly confirmedTripId: TripId | null;
  readonly origin: DataOrigin;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
}

export const MAX_MERGE_SPAN_MS = 90 * DAY_MS;

export function createCandidate(input: {
  id: string;
  importBatchId: ImportBatchId;
  timeRange: TimeRange;
  photoIds: readonly string[];
  cityRefs: readonly CityRef[];
  locationMissingCount: number;
  splitReasons: readonly SplitReason[];
  confidence: 'high' | 'low';
  derivedFrom: readonly CandidateId[];
  origin: DataOrigin;
  createdAt: Instant;
}): Result<Candidate> {
  if (input.photoIds.length === 0) {
    return err(domainError('CANDIDATE_EMPTY', '候选必须包含照片'));
  }
  const unique = new Set(input.photoIds);
  if (unique.size !== input.photoIds.length) {
    return err(domainError('VALIDATION_FAILED', '候选内照片不得重复'));
  }
  const range = makeTimeRange(input.timeRange.start, input.timeRange.end);
  if (!range.ok) return range;
  if (input.splitReasons.length === 0) {
    return err(domainError('VALIDATION_FAILED', '候选必须记录切分原因'));
  }
  return ok({
    id: input.id as CandidateId,
    importBatchId: input.importBatchId,
    timeRange: range.value,
    photoIds: [...input.photoIds],
    cityRefs: [...input.cityRefs],
    locationMissingCount: input.locationMissingCount,
    splitReasons: [...input.splitReasons],
    confidence: input.confidence,
    status: 'pending',
    derivedFrom: [...input.derivedFrom],
    supersededBy: [],
    confirmedTripId: null,
    origin: input.origin,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  });
}

export function validateCandidate(candidate: Candidate): Result<Candidate> {
  if (candidate.photoIds.length === 0) {
    return err(domainError('CANDIDATE_EMPTY', '候选必须包含照片', { id: candidate.id }));
  }
  if (new Set(candidate.photoIds).size !== candidate.photoIds.length) {
    return err(domainError('VALIDATION_FAILED', '候选内照片不得重复', { id: candidate.id }));
  }
  if (!Number.isFinite(candidate.timeRange.start) || !Number.isFinite(candidate.timeRange.end) || candidate.timeRange.start >= candidate.timeRange.end) {
    return err(domainError('TIME_RANGE_INVALID', '候选时间区间非法', { id: candidate.id }));
  }
  return ok(candidate);
}

export function isPending(candidate: Candidate): boolean {
  return candidate.status === 'pending';
}

/** I-12: only pending candidates can be edited, confirmed, merged, split or ignored. */
export function assertPending(candidate: Candidate | null, id: CandidateId): Result<Candidate> {
  if (!candidate) {
    return err(domainError('CANDIDATE_NOT_FOUND', '候选不存在', { id }));
  }
  if (candidate.status !== 'pending') {
    return err(domainError('CANDIDATE_NOT_PENDING', '只有待确认的候选可以操作', { id, status: candidate.status }));
  }
  return ok(candidate);
}

export function markConfirmed(candidate: Candidate, tripId: TripId, now: Instant): Candidate {
  return { ...candidate, status: 'confirmed', confirmedTripId: tripId, updatedAt: now };
}

export function markIgnored(candidate: Candidate, now: Instant): Candidate {
  return { ...candidate, status: 'ignored', updatedAt: now };
}

export function markRestored(candidate: Candidate, now: Instant): Result<Candidate> {
  if (candidate.status !== 'ignored') {
    return err(domainError('CANDIDATE_NOT_PENDING', '只有已忽略的候选可以恢复', { id: candidate.id }));
  }
  return ok({ ...candidate, status: 'pending', updatedAt: now });
}

export function markMerged(candidate: Candidate, into: CandidateId, now: Instant): Candidate {
  return {
    ...candidate,
    status: 'merged',
    supersededBy: [...candidate.supersededBy, into],
    updatedAt: now,
  };
}

export function markSplit(candidate: Candidate, parts: readonly CandidateId[], now: Instant): Candidate {
  return {
    ...candidate,
    status: 'split',
    supersededBy: [...candidate.supersededBy, ...parts],
    updatedAt: now,
  };
}

export function mergeCandidateRecords(input: {
  a: Candidate;
  b: Candidate;
  photos: readonly Photo[];
  newId: string;
  resolveCity: CityLookup;
  defaultOffsetMinutes: number;
  now: Instant;
}): Result<Candidate> {
  const { a, b } = input;
  if (a.id === b.id) {
    return err(domainError('MERGE_SAME_CANDIDATE', '不能把候选与自身合并'));
  }
  if (a.status !== 'pending' || b.status !== 'pending') {
    return err(domainError('CANDIDATE_NOT_PENDING', '只有待确认的候选可以合并'));
  }
  if (a.origin !== b.origin) {
    return err(domainError('ORIGIN_MIXED', '示例数据与真实数据不能合并'));
  }
  const idSet = new Set([...a.photoIds, ...b.photoIds]);
  const photos = input.photos.filter((photo) => idSet.has(photo.id));
  if (photos.length === 0) {
    return err(domainError('CANDIDATE_EMPTY', '合并后没有照片'));
  }
  const summary = summarizePhotos(photos, input.resolveCity, input.defaultOffsetMinutes);
  if (summary.timeRange.end - summary.timeRange.start > MAX_MERGE_SPAN_MS) {
    return err(domainError('MERGE_TOO_LONG', '合并后的旅程不能超过 90 天'));
  }
  return createCandidate({
    id: input.newId,
    importBatchId: a.importBatchId,
    timeRange: summary.timeRange,
    photoIds: photos.map((photo) => photo.id).sort(),
    cityRefs: summary.cityRefs,
    locationMissingCount: summary.locationMissingCount,
    splitReasons: Array.from(new Set([...a.splitReasons, ...b.splitReasons, 'manual' as const])),
    confidence: summary.confidence,
    derivedFrom: [a.id, b.id],
    origin: a.origin,
    createdAt: input.now,
  });
}

export function splitCandidateRecord(input: {
  candidate: Candidate;
  at: Instant;
  photos: readonly Photo[];
  ids: readonly [string, string];
  resolveCity: CityLookup;
  defaultOffsetMinutes: number;
  now: Instant;
}): Result<readonly [Candidate, Candidate]> {
  const { candidate, at } = input;
  if (candidate.status !== 'pending') {
    return err(domainError('CANDIDATE_NOT_PENDING', '只有待确认的候选可以拆分'));
  }
  if (!(at > candidate.timeRange.start && at < candidate.timeRange.end)) {
    return err(domainError('SPLIT_AT_BOUNDARY', '切分点必须严格位于候选时间范围内'));
  }
  const members = input.photos.filter((photo) => candidate.photoIds.includes(photo.id));
  const left = members.filter((photo) => photo.capturedAt < at);
  const right = members.filter((photo) => photo.capturedAt >= at);
  if (left.length === 0 || right.length === 0) {
    return err(domainError('SPLIT_EMPTY_SIDE', '切分后两侧都必须有照片'));
  }
  const build = (photos: readonly Photo[], id: string): Result<Candidate> => {
    const summary = summarizePhotos(photos, input.resolveCity, input.defaultOffsetMinutes);
    return createCandidate({
      id,
      importBatchId: candidate.importBatchId,
      timeRange: summary.timeRange,
      photoIds: photos.map((photo) => photo.id).sort(),
      cityRefs: summary.cityRefs,
      locationMissingCount: summary.locationMissingCount,
      splitReasons: Array.from(new Set([...candidate.splitReasons, 'manual' as const])),
      confidence: summary.confidence,
      derivedFrom: [candidate.id],
      origin: candidate.origin,
      createdAt: input.now,
    });
  };
  const first = build(left, input.ids[0]);
  if (!first.ok) return first;
  const second = build(right, input.ids[1]);
  if (!second.ok) return second;
  return ok([first.value, second.value] as const);
}
