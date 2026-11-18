import type { Candidate, SplitReason } from '../domain/candidate/candidate';
import type { CityRef } from '../domain/city/city-ref';
import { DAY_MS } from '../domain/common/time';
import type { ImportIssue } from '../domain/import/import-issue';
import type { Photo } from '../domain/photo/photo';
import type { Wish } from '../domain/wish/wish';
import { fmtLocalDate, fmtLocalTime, yearOf } from './format';

const REASON_LABELS: Record<SplitReason, string> = {
  'time-gap': '时间间隔',
  'far-place': '远距离跳变',
  'max-days': '单段最长天数',
  manual: '初始分段',
};

export function reasonLabel(reason: SplitReason): string {
  return REASON_LABELS[reason];
}

export function candidateReasons(candidate: Candidate): string {
  return candidate.splitReasons.map(reasonLabel).join(' · ');
}

export function candidateTitle(candidate: Candidate, offsetMinutes: number | null = null): string {
  const names = candidate.cityRefs.map((city) => city.name).slice(0, 2);
  const year = yearOf(candidate.timeRange.end - 1 + (offsetMinutes ?? 0) * 60_000);
  if (names.length === 0) return `${year} 年旅行`;
  return `${year} ${names.join(' · ')}`;
}

export function dayKeyOf(at: number, offsetMinutes: number | null = null): string {
  return fmtLocalDate(at, offsetMinutes);
}

export interface DayGroup<T> {
  readonly key: string;
  readonly label: string;
  readonly items: readonly T[];
}

export function groupByDay<T>(items: readonly T[], at: (item: T) => number, offsetOf?: (item: T) => number | null): DayGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = dayKeyOf(at(item), offsetOf?.(item) ?? null);
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  return Array.from(groups.entries()).map(([key, list]) => ({
    key,
    label: key,
    items: list,
  }));
}

export function relativeMinutes(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return '同一分钟';
  if (minutes < 60) return `${minutes} 分`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} 小时`;
  return `${Math.round(hours / 24)} 天`;
}

export function issueLabel(issue: ImportIssue): string {
  return issue.message;
}

export function photoTime(photo: Photo): string {
  return `${fmtLocalDate(photo.capturedAt, photo.captureOffsetMinutes)} ${fmtLocalTime(photo.capturedAt, photo.captureOffsetMinutes)}`;
}

export function wishTitle(wish: Wish): string {
  return `${wish.cityRef.name}${wish.region ? ` · ${wish.region}` : ''}`;
}

export function wishSourceLabel(wish: Wish): string {
  if (wish.source === 'demo') return '示例数据';
  if (wish.source === 'import') return '导入';
  return '手动添加';
}

export function daysBetween(start: number, end: number): number {
  return Math.max(1, Math.round((end - start) / DAY_MS));
}

export function cityNames(cities: readonly CityRef[], limit = 3): string {
  const names = cities.map((city) => city.name);
  if (names.length <= limit) return names.join(' / ');
  return `${names.slice(0, limit).join(' / ')} 等 ${names.length} 城`;
}

export const MONTHS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

export function monthDayLabel(key: string): string {
  const parts = key.split('-');
  const month = Number(parts[1] ?? '1');
  const day = Number(parts[2] ?? '1');
  return `${MONTHS[month - 1] ?? month}月${day}日`;
}
