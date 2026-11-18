import type { CandidateId, MemoryId, PhotoId, TripId } from '../common/ids';
import { cityKey, type CityRef } from '../city/city-ref';
import { domainError, err, ok, type Result } from '../common/result';
import { isFiniteInstant, overlaps, type Instant, type TimeRange } from '../common/time';
import type { DataOrigin, Photo } from '../photo/photo';
import type { Visit } from '../visit/visit';

export interface Trip {
  readonly id: TripId;
  readonly title: string;
  readonly timeRange: TimeRange;
  readonly cityRefs: readonly CityRef[];
  readonly memoryId: MemoryId | null;
  readonly coverPhotoId: PhotoId | null;
  readonly sourceCandidateId: CandidateId | null;
  readonly origin: DataOrigin;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
}

export interface CreateTripInput {
  id: string;
  title: string;
  timeRange: TimeRange;
  cityRefs: readonly CityRef[];
  coverPhotoId: PhotoId | null;
  sourceCandidateId: CandidateId | null;
  origin: DataOrigin;
  createdAt: Instant;
}

export function createTrip(input: CreateTripInput): Result<Trip> {
  const title = input.title.trim();
  if (title.length === 0 || title.length > 40) {
    return err(domainError('VALIDATION_FAILED', '旅程标题长度必须在 1–40 字符之间'));
  }
  if (!isFiniteInstant(input.timeRange.start) || !isFiniteInstant(input.timeRange.end) || input.timeRange.start >= input.timeRange.end) {
    return err(domainError('TRIP_RANGE_INVALID', '旅程时间区间非法'));
  }
  const keys = new Set<string>();
  for (const city of input.cityRefs) {
    if (keys.has(city.key)) {
      return err(domainError('CITY_DUPLICATE', '同一旅程内城市必须去重', { key: city.key }));
    }
    keys.add(city.key);
  }
  return ok({
    id: input.id as TripId,
    title,
    timeRange: input.timeRange,
    cityRefs: [...input.cityRefs],
    memoryId: null,
    coverPhotoId: input.coverPhotoId,
    sourceCandidateId: input.sourceCandidateId,
    origin: input.origin,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  });
}

export function validateTrip(trip: Trip): Result<Trip> {
  if (trip.title.trim().length === 0 || trip.title.length > 40) {
    return err(domainError('VALIDATION_FAILED', '旅程标题长度必须在 1–40 字符之间', { id: trip.id }));
  }
  if (!isFiniteInstant(trip.timeRange.start) || !isFiniteInstant(trip.timeRange.end) || trip.timeRange.start >= trip.timeRange.end) {
    return err(domainError('TRIP_RANGE_INVALID', '旅程时间区间非法', { id: trip.id }));
  }
  const seen = new Set<string>();
  for (const city of trip.cityRefs) {
    if (seen.has(city.key)) {
      return err(domainError('CITY_DUPLICATE', '同一旅程内城市必须去重', { id: trip.id }));
    }
    seen.add(city.key);
  }
  return ok(trip);
}

/** I-05: confirmed trips never overlap. */
export function findOverlappingTrip(trips: readonly Trip[], range: TimeRange, ignoreId?: TripId): Trip | null {
  for (const trip of trips) {
    if (ignoreId && trip.id === ignoreId) continue;
    if (overlaps(trip.timeRange, range)) return trip;
  }
  return null;
}

export function validateTripSet(trips: readonly Trip[]): Result<true> {
  const sorted = trips.slice().sort((a, b) => a.timeRange.start - b.timeRange.start);
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (!previous || !current) continue;
    if (overlaps(previous.timeRange, current.timeRange)) {
      return err(domainError('TRIP_TIME_OVERLAP', '已确认旅程的时间区间不得重叠', {
        first: previous.id,
        second: current.id,
      }));
    }
  }
  return ok(true);
}

/** I-06 / I-07: trip range covers its photos and a trip always has at least one photo. */
export function validateTripPhotos(trip: Trip, photos: readonly Photo[]): Result<true> {
  const members = photos.filter((photo) => photo.tripId === trip.id);
  if (members.length === 0) {
    return err(domainError('EMPTY_TRIP', '旅程至少需要 1 张照片', { id: trip.id }));
  }
  for (const photo of members) {
    if (photo.capturedAt < trip.timeRange.start || photo.capturedAt >= trip.timeRange.end) {
      return err(domainError('TRIP_RANGE_INVALID', '照片不在旅程时间范围内', { id: photo.id }));
    }
  }
  if (trip.coverPhotoId !== null && !members.some((photo) => photo.id === trip.coverPhotoId)) {
    return err(domainError('VALIDATION_FAILED', '封面照片必须属于本旅程', { id: trip.id }));
  }
  return ok(true);
}

export function citiesOfVisits(visits: readonly Visit[]): CityRef[] {
  const seen = new Set<string>();
  const out: CityRef[] = [];
  for (const visit of visits) {
    if (seen.has(visit.cityRef.key)) continue;
    seen.add(visit.cityRef.key);
    out.push(visit.cityRef);
  }
  return out;
}

export function tripTitleFrom(year: number, cities: readonly CityRef[]): string {
  const names = cities.map((city) => city.name).filter((name) => name.length > 0);
  if (names.length === 0) return `${year} 年旅行`;
  const head = names.slice(0, 2).join(' · ');
  return `${year} ${head}`.slice(0, 40);
}

export function cityKeysOfTrip(trip: Trip): string[] {
  return trip.cityRefs.map((city) => city.key);
}

export function tripCityKey(trip: Trip, city: CityRef): string {
  return cityKey(city.countryCode, city.name) ?? trip.id;
}
