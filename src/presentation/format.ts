import type { TimeRange } from '../domain/common/time';
import type { CityRef } from '../domain/city/city-ref';
import { DAY_MS } from '../domain/common/time';

const DATE = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: 'UTC',
});

const DATE_SHORT = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  timeZone: 'UTC',
});

const TIME = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
});

export function fmtDate(at: number): string {
  const parts = DATE.formatToParts(at);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

export function fmtMonthDay(at: number): string {
  const parts = DATE_SHORT.formatToParts(at);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${pick('month')}-${pick('day')}`;
}

export function fmtTime(at: number): string {
  return TIME.format(at);
}

const MINUTE_MS = 60_000;

/** Wall-clock formatting in the capture timezone: UTC instant shifted by the recorded EXIF offset. */
export function fmtLocalDate(at: number, offsetMinutes: number | null): string {
  return fmtDate(at + (offsetMinutes ?? 0) * MINUTE_MS);
}

export function fmtLocalMonthDay(at: number, offsetMinutes: number | null): string {
  return fmtMonthDay(at + (offsetMinutes ?? 0) * MINUTE_MS);
}

export function fmtLocalTime(at: number, offsetMinutes: number | null): string {
  return fmtTime(at + (offsetMinutes ?? 0) * MINUTE_MS);
}

/** `2025-05-02 → 05-07` in the capture timezone, using the trailing day of a half-open range. */
export function fmtLocalRange(range: TimeRange, offsetMinutes: number | null): string {
  const shift = (offsetMinutes ?? 0) * MINUTE_MS;
  const start = range.start + shift;
  const end = range.end - 1 + shift;
  if (fmtDate(start).slice(0, 4) === fmtDate(end).slice(0, 4)) {
    return `${fmtDate(start)} → ${fmtMonthDay(end)}`;
  }
  return `${fmtDate(start)} → ${fmtDate(end)}`;
}

/** `2025-05-02 → 05-07`, using the trailing day of a half-open range. */
export function fmtRange(range: TimeRange): string {
  const start = range.start;
  const end = range.end - 1;
  if (fmtDate(start).slice(0, 4) === fmtDate(end).slice(0, 4)) {
    return `${fmtDate(start)} → ${fmtMonthDay(end)}`;
  }
  return `${fmtDate(start)} → ${fmtDate(end)}`;
}

export function daysOf(range: TimeRange): number {
  return Math.max(1, Math.round((range.end - range.start) / DAY_MS));
}

export function cityLabel(cities: readonly CityRef[], limit = 2): string {
  if (cities.length === 0) return '未识别地点';
  const names = cities.map((city) => city.name);
  if (names.length <= limit) return names.join(' / ');
  return `${names.slice(0, limit).join(' / ')} 等 ${names.length} 城`;
}

export function countryLabel(cities: readonly CityRef[]): string {
  const names: string[] = [];
  for (const city of cities) {
    if (!names.includes(city.countryName)) names.push(city.countryName);
  }
  return names.join(' / ') || '未知';
}

export function yearOf(at: number): number {
  return new Date(at).getUTCFullYear();
}

export function toDateTimeLocal(at: number): string {
  const date = new Date(at);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

export function fromDateTimeLocal(value: string): number | null {
  if (!value) return null;
  const parsed = Date.parse(`${value}:00Z`);
  return Number.isFinite(parsed) ? parsed : null;
}

const PLACEHOLDERS = ['temple', 'forest', 'sea', 'city', 'snow', 'sunset', 'night'] as const;

export function placeholderFor(key: string): string {
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  return `ph--${PLACEHOLDERS[hash % PLACEHOLDERS.length]}`;
}

export function percent(value: number, total: number): string {
  if (total <= 0) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}

export function plural(value: number, unit: string): string {
  return `${value} ${unit}`;
}
