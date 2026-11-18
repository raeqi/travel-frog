import type { TripId, VisitId } from '../common/ids';
import type { CityRef } from '../city/city-ref';
import { domainError, err, ok, type Result } from '../common/result';
import { makeTimeRange, type Instant, type TimeRange } from '../common/time';
import type { Confidence } from '../city/city-ref';
import type { GeoPoint, LocationSource } from '../geo/geo-point';
import type { Photo } from '../photo/photo';

export interface Visit {
  readonly id: VisitId;
  readonly tripId: TripId;
  readonly sequence: number;
  readonly cityRef: CityRef;
  readonly displayName: string;
  readonly timeRange: TimeRange;
  readonly geo: GeoPoint | null;
  readonly locationSource: LocationSource;
  readonly confidence: Confidence;
}

export function createVisit(input: {
  id: string;
  tripId: TripId;
  sequence: number;
  cityRef: CityRef;
  displayName: string;
  timeRange: TimeRange;
  geo: GeoPoint | null;
  locationSource: LocationSource;
  confidence: Confidence;
}): Result<Visit> {
  const displayName = input.displayName.trim();
  if (displayName.length === 0 || displayName.length > 40) {
    return err(domainError('VALIDATION_FAILED', '站点名称长度必须在 1–40 字符之间'));
  }
  if (!Number.isInteger(input.sequence) || input.sequence < 0) {
    return err(domainError('VISIT_ORDER_INVALID', '站点序号必须是从 0 开始的整数'));
  }
  const range = makeTimeRange(input.timeRange.start, input.timeRange.end);
  if (!range.ok) return range;
  if (input.geo === null && input.locationSource !== 'none') {
    return err(domainError('GEO_INVALID', '无坐标时位置来源必须为 none'));
  }
  return ok({
    id: input.id as VisitId,
    tripId: input.tripId,
    sequence: input.sequence,
    cityRef: input.cityRef,
    displayName,
    timeRange: range.value,
    geo: input.geo,
    locationSource: input.locationSource,
    confidence: input.confidence,
  });
}

export function validateVisit(visit: Visit): Result<Visit> {
  if (visit.displayName.trim().length === 0 || visit.displayName.length > 40) {
    return err(domainError('VALIDATION_FAILED', '站点名称长度必须在 1–40 字符之间', { id: visit.id }));
  }
  if (!Number.isInteger(visit.sequence) || visit.sequence < 0) {
    return err(domainError('VISIT_ORDER_INVALID', '站点序号非法', { id: visit.id }));
  }
  if (!Number.isFinite(visit.timeRange.start) || !Number.isFinite(visit.timeRange.end) || visit.timeRange.start >= visit.timeRange.end) {
    return err(domainError('TIME_RANGE_INVALID', '站点时间区间非法', { id: visit.id }));
  }
  if ((visit.geo === null) !== (visit.locationSource === 'none')) {
    return err(domainError('GEO_INVALID', '站点坐标与来源不一致', { id: visit.id }));
  }
  return ok(visit);
}

/** I-04: sequence is contiguous from 0 and visit ranges never overlap inside a trip. */
export function validateVisitOrder(visits: readonly Visit[], tripId: TripId): Result<readonly Visit[]> {
  const scoped = visits.filter((visit) => visit.tripId === tripId).slice().sort((a, b) => a.sequence - b.sequence);
  for (let index = 0; index < scoped.length; index += 1) {
    const visit = scoped[index];
    if (!visit) continue;
    if (visit.sequence !== index) {
      return err(domainError('VISIT_ORDER_INVALID', '站点序号必须从 0 连续', { id: visit.id }));
    }
    const previous = scoped[index - 1];
    if (previous && previous.timeRange.end > visit.timeRange.start) {
      return err(domainError('VISIT_ORDER_INVALID', '同一旅程内的站点时间不得重叠', { id: visit.id }));
    }
  }
  return ok(scoped);
}

/** Visit ranges must cover their photos and stay inside the trip. */
export function validateVisitsAgainstPhotos(
  tripId: TripId,
  tripRange: TimeRange,
  visits: readonly Visit[],
  photos: readonly Photo[],
): Result<true> {
  const order = validateVisitOrder(visits, tripId);
  if (!order.ok) return order;

  const byVisit = new Map<string, Photo[]>();
  for (const photo of photos) {
    if (photo.tripId !== tripId || photo.visitId === null) continue;
    const list = byVisit.get(photo.visitId) ?? [];
    list.push(photo);
    byVisit.set(photo.visitId, list);
  }
  for (const visit of visits) {
    if (visit.timeRange.start < tripRange.start || visit.timeRange.end > tripRange.end) {
      return err(domainError('TRIP_RANGE_INVALID', '站点时间超出旅程范围', { id: visit.id }));
    }
    const members = byVisit.get(visit.id) ?? [];
    if (members.length === 0) {
      return err(domainError('VISIT_ORPHANED', '站点没有照片', { id: visit.id }));
    }
    for (const photo of members) {
      if (photo.capturedAt < visit.timeRange.start || photo.capturedAt >= visit.timeRange.end) {
        return err(domainError('VISIT_ORDER_INVALID', '照片不在所属站点时间内', { id: photo.id }));
      }
    }
  }
  return ok(true);
}

export function sortVisits(visits: readonly Visit[]): Visit[] {
  return visits.slice().sort((a, b) => a.sequence - b.sequence);
}

export function visitRange(first: Instant, last: Instant): TimeRange {
  return { start: first, end: last + 1 };
}
