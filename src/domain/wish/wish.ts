import type { CityRef } from '../city/city-ref';
import type { WishId } from '../common/ids';
import { domainError, err, ok, type Result } from '../common/result';
import { isFiniteInstant, type Instant } from '../common/time';
import type { DataOrigin } from '../photo/photo';

/** PRD §13.2: the five states a postcard can be in. */
export type WishStatus = 'pending' | 'received' | 'wished' | 'fulfilled' | 'declined';
/** `frog` = the frog brought it back; `user` = the user entrusted the frog with it. */
export type WishSource = 'frog' | 'user';

export const WISH_STATUSES: readonly WishStatus[] = ['pending', 'received', 'wished', 'fulfilled', 'declined'];

const TRANSITIONS: Readonly<Record<WishStatus, readonly WishStatus[]>> = {
  pending: ['received'],
  received: ['wished', 'declined'],
  wished: ['received', 'fulfilled'],
  fulfilled: [],
  declined: [],
};

export interface Wish {
  readonly id: WishId;
  readonly cityRef: CityRef;
  /** Display region / country line; never used for identity. */
  readonly region: string | null;
  /** The one sentence written on the postcard. Empty while pending. */
  readonly note: string | null;
  readonly status: WishStatus;
  readonly source: WishSource;
  /** City key the frog set out from, used for the fly-in direction and copy. */
  readonly from: string | null;
  readonly origin: DataOrigin;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
}

export function isWishStatus(value: unknown): value is WishStatus {
  return typeof value === 'string' && (WISH_STATUSES as readonly string[]).includes(value);
}

export function canTransitionWish(from: WishStatus, to: WishStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export interface CreateWishInput {
  id: string;
  cityRef: CityRef;
  region: string | null;
  note: string | null;
  source: WishSource;
  from?: string | null;
  origin: DataOrigin;
  now: Instant;
  status?: WishStatus;
}

export function createWish(input: CreateWishInput): Result<Wish> {
  const region = input.region?.trim() ?? null;
  const status = input.status ?? 'pending';
  const note = status === 'pending' ? null : input.note?.trim() ?? null;
  if (!isWishStatus(status)) {
    return err(domainError('WISH_STATE_INVALID', '未知的明信片状态'));
  }
  if (region !== null && region.length > 40) {
    return err(domainError('VALIDATION_FAILED', '地区名称不能超过 40 字符'));
  }
  if (note !== null && note.length > 200) {
    return err(domainError('VALIDATION_FAILED', '明信片留言不能超过 200 字符'));
  }
  if (input.cityRef.name.trim().length === 0) {
    return err(domainError('VALIDATION_FAILED', '明信片需要一个地点名称'));
  }
  if ((status === 'received' || status === 'wished' || status === 'fulfilled') && note === null) {
    return err(domainError('WISH_STATE_INVALID', '已寄到的明信片必须有青蛙的留言'));
  }
  return ok({
    id: input.id as WishId,
    cityRef: input.cityRef,
    region,
    note,
    status,
    source: input.source,
    from: input.from?.trim() || null,
    origin: input.origin,
    createdAt: input.now,
    updatedAt: input.now,
  });
}

export interface TransitionExtras {
  readonly note?: string | null;
  readonly from?: string | null;
}

/**
 * Pure state machine. Illegal transitions (including same-state) return a Result error
 * instead of silently passing, so persistence and tests can reject them explicitly.
 */
export function changeWishStatus(
  wish: Wish,
  status: WishStatus,
  now: Instant,
  extras: TransitionExtras = {},
): Result<Wish> {
  if (!isWishStatus(status)) {
    return err(domainError('WISH_STATE_INVALID', '未知的明信片状态', { id: wish.id }));
  }
  if (!canTransitionWish(wish.status, status)) {
    return err(domainError('WISH_STATE_INVALID', `明信片不能从「${wish.status}」变为「${status}」`, {
      id: wish.id,
      from: wish.status,
      to: status,
    }));
  }
  const note = extras.note === undefined ? wish.note : extras.note?.trim() ?? null;
  const from = extras.from === undefined ? wish.from : extras.from?.trim() || null;
  if (status === 'received' && (note === null || note.length === 0)) {
    return err(domainError('WISH_STATE_INVALID', '青蛙寄到的明信片必须有一句话', { id: wish.id }));
  }
  if (note !== null && note.length > 200) {
    return err(domainError('VALIDATION_FAILED', '明信片留言不能超过 200 字符', { id: wish.id }));
  }
  return ok({ ...wish, status, note, from, updatedAt: now });
}

export function validateWish(wish: Wish): Result<Wish> {
  if (!isWishStatus(wish.status)) {
    return err(domainError('WISH_STATE_INVALID', '未知的明信片状态', { id: wish.id }));
  }
  if (wish.status !== 'pending' && (wish.note === null || wish.note.trim().length === 0)) {
    return err(domainError('WISH_STATE_INVALID', '已寄出的明信片必须有留言', { id: wish.id }));
  }
  if (wish.status === 'pending' && wish.note !== null && wish.note.trim().length > 0) {
    return err(domainError('WISH_STATE_INVALID', '待寄的明信片还没有留言', { id: wish.id }));
  }
  if (wish.note !== null && wish.note.length > 200) {
    return err(domainError('VALIDATION_FAILED', '明信片留言不能超过 200 字符', { id: wish.id }));
  }
  if (wish.region !== null && wish.region.length > 40) {
    return err(domainError('VALIDATION_FAILED', '地区名称不能超过 40 字符', { id: wish.id }));
  }
  if (!isFiniteInstant(wish.createdAt) || !isFiniteInstant(wish.updatedAt)) {
    return err(domainError('WISH_STATE_INVALID', '明信片时间戳无效', { id: wish.id }));
  }
  return ok(wish);
}

/**
 * One-time bridge for archives written before v3: old `wish`/`next` become `wished`,
 * old `visited` becomes `fulfilled`. Unknown values are rejected so data is never guessed.
 */
export function migrateLegacyWishStatus(status: unknown): Result<WishStatus> {
  if (isWishStatus(status)) return ok(status);
  if (status === 'wish' || status === 'next') return ok('wished');
  if (status === 'visited') return ok('fulfilled');
  return err(domainError('WISH_STATE_INVALID', '无法识别的旧愿望状态', { status: String(status) }));
}

export function wishStatusLabel(status: WishStatus): string {
  switch (status) {
    case 'pending':
      return '待寄';
    case 'received':
      return '已寄到';
    case 'wished':
      return '想去';
    case 'fulfilled':
      return '兑现';
    case 'declined':
      return '退回';
  }
}
