import type { CityRef } from '../city/city-ref';
import type { WishId } from '../common/ids';
import { domainError, err, ok, type Result } from '../common/result';
import { isFiniteInstant, type Instant } from '../common/time';
import type { DataOrigin } from '../photo/photo';

export type WishStatus = 'wish' | 'next' | 'visited';
export type WishSource = 'manual' | 'demo' | 'import';

export interface Wish {
  readonly id: WishId;
  readonly cityRef: CityRef;
  readonly region: string | null;
  readonly notes: string | null;
  readonly status: WishStatus;
  readonly source: WishSource;
  readonly origin: DataOrigin;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
  readonly visitedAt: Instant | null;
}

export function createWish(input: {
  id: string;
  cityRef: CityRef;
  region: string | null;
  notes: string | null;
  origin: DataOrigin;
  source: WishSource;
  now: Instant;
}): Result<Wish> {
  const region = input.region?.trim() ?? null;
  const notes = input.notes?.trim() ?? null;
  if (region !== null && region.length > 40) {
    return err(domainError('VALIDATION_FAILED', '地区名称不能超过 40 字符'));
  }
  if (notes !== null && notes.length > 200) {
    return err(domainError('VALIDATION_FAILED', '备注不能超过 200 字符'));
  }
  if (input.cityRef.name.trim().length === 0) {
    return err(domainError('VALIDATION_FAILED', '愿望需要一个地点名称'));
  }
  return ok({
    id: input.id as WishId,
    cityRef: input.cityRef,
    region,
    notes,
    status: 'wish',
    source: input.source,
    origin: input.origin,
    createdAt: input.now,
    updatedAt: input.now,
    visitedAt: null,
  });
}

/** I-15: visited is terminal; visitedAt must agree with the status. */
export function changeWishStatus(wish: Wish, status: WishStatus, now: Instant): Result<Wish> {
  if (wish.status === status) {
    return ok({ ...wish, updatedAt: now });
  }
  if (wish.status === 'visited') {
    return err(domainError('WISH_STATE_INVALID', '已去过的地方不能再改回想去'));
  }
  if (status === 'visited') {
    return ok({ ...wish, status, visitedAt: now, updatedAt: now });
  }
  return ok({ ...wish, status, visitedAt: null, updatedAt: now });
}

export function validateWish(wish: Wish): Result<Wish> {
  if (wish.status === 'visited' && !isFiniteInstant(wish.visitedAt ?? Number.NaN)) {
    return err(domainError('WISH_STATE_INVALID', '标记去过时必须记录时间', { id: wish.id }));
  }
  if (wish.status !== 'visited' && wish.visitedAt !== null) {
    return err(domainError('WISH_STATE_INVALID', '未去过的地方不应有到访时间', { id: wish.id }));
  }
  if (wish.notes !== null && wish.notes.length > 200) {
    return err(domainError('VALIDATION_FAILED', '备注不能超过 200 字符', { id: wish.id }));
  }
  return ok(wish);
}
