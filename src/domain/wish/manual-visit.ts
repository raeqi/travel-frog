import type { CityRef } from '../city/city-ref';
import type { ManualVisitId, WishId } from '../common/ids';
import { domainError, err, ok, type Result } from '../common/result';
import { isFiniteInstant, type Instant } from '../common/time';

export interface ManualVisit {
  readonly id: ManualVisitId;
  readonly cityRef: CityRef;
  readonly year: number;
  readonly source: 'wish' | 'manual';
  readonly sourceWishId: WishId | null;
  readonly createdAt: Instant;
}

export function createManualVisit(input: {
  id: string;
  cityRef: CityRef;
  year: number;
  source: 'wish' | 'manual';
  sourceWishId: WishId | null;
  createdAt: Instant;
  currentYear: number;
}): Result<ManualVisit> {
  if (!Number.isInteger(input.year) || input.year < 1900 || input.year > input.currentYear + 1) {
    return err(domainError('VALIDATION_FAILED', '年份超出有效范围'));
  }
  if (input.source === 'wish' && input.sourceWishId === null) {
    return err(domainError('VALIDATION_FAILED', '由愿望生成的手动足迹必须记录来源愿望'));
  }
  if (!isFiniteInstant(input.createdAt)) {
    return err(domainError('VALIDATION_FAILED', '创建时间无效'));
  }
  return ok({
    id: input.id as ManualVisitId,
    cityRef: input.cityRef,
    year: input.year,
    source: input.source,
    sourceWishId: input.sourceWishId,
    createdAt: input.createdAt,
  });
}

/** I-16: one manual visit per city key and year. */
export function findManualVisit(
  visits: readonly ManualVisit[],
  cityKey: string,
  year: number,
): ManualVisit | null {
  return visits.find((visit) => visit.cityRef.key === cityKey && visit.year === year) ?? null;
}
