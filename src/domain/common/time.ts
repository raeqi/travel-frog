import { domainError, err, ok, type Result } from './result';

/** UTC epoch milliseconds. */
export type Instant = number;
/** Minutes east of UTC at the place of capture, -720..840. */
export type OffsetMinutes = number;

export const MINUTE_MS = 60_000;
export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;

/** Half-open interval [start, end). */
export interface TimeRange {
  readonly start: Instant;
  readonly end: Instant;
}

export function isFiniteInstant(value: unknown): value is Instant {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value);
}

export function makeTimeRange(start: Instant, end: Instant): Result<TimeRange> {
  if (!isFiniteInstant(start) || !isFiniteInstant(end)) {
    return err(domainError('TIME_RANGE_INVALID', '时间必须是有限整数毫秒'));
  }
  if (start >= end) {
    return err(domainError('TIME_RANGE_INVALID', '时间区间必须满足 start < end'));
  }
  return ok({ start, end });
}

export function rangeFromMinimum(start: Instant): TimeRange {
  return { start, end: start + 1 };
}

export function overlaps(a: TimeRange, b: TimeRange): boolean {
  return a.start < b.end && b.start < a.end;
}

export function contains(range: TimeRange, at: Instant): boolean {
  return range.start <= at && at < range.end;
}

export function durationMs(range: TimeRange): number {
  return range.end - range.start;
}

export function isValidOffset(minutes: number | null): minutes is OffsetMinutes {
  return minutes !== null && Number.isInteger(minutes) && minutes >= -720 && minutes <= 840;
}

/** Offset used for local-day arithmetic; unknown offsets fall back to the device offset. */
export function effectiveOffset(minutes: number | null, fallback: OffsetMinutes): OffsetMinutes {
  return isValidOffset(minutes) ? minutes : fallback;
}

export function startOfLocalDay(at: Instant, offsetMinutes: OffsetMinutes): Instant {
  const local = at + offsetMinutes * MINUTE_MS;
  const dayStart = Math.floor(local / DAY_MS) * DAY_MS;
  return dayStart - offsetMinutes * MINUTE_MS;
}

export function startOfNextLocalDay(at: Instant, offsetMinutes: OffsetMinutes): Instant {
  return startOfLocalDay(at, offsetMinutes) + DAY_MS;
}

export function localDayKey(at: Instant, offsetMinutes: OffsetMinutes): string {
  const local = new Date(at + offsetMinutes * MINUTE_MS);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, '0');
  const d = String(local.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function localYear(at: Instant, offsetMinutes: OffsetMinutes): number {
  return new Date(at + offsetMinutes * MINUTE_MS).getUTCFullYear();
}

export function localMonth(at: Instant, offsetMinutes: OffsetMinutes): number {
  return new Date(at + offsetMinutes * MINUTE_MS).getUTCMonth() + 1;
}

export function localDayDiff(a: Instant, b: Instant, offsetMinutes: OffsetMinutes): number {
  return Math.round((startOfLocalDay(a, offsetMinutes) - startOfLocalDay(b, offsetMinutes)) / DAY_MS);
}

/** Expands a photo-time span to whole local days, matching Trip.timeRange semantics. */
export function toLocalDayRange(
  first: Instant,
  last: Instant,
  firstOffset: OffsetMinutes,
  lastOffset: OffsetMinutes,
): TimeRange {
  return {
    start: startOfLocalDay(first, firstOffset),
    end: startOfLocalDay(last, lastOffset) + DAY_MS,
  };
}
