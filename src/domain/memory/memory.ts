import type { MemoryId, TripId } from '../common/ids';
import { domainError, err, ok, type Result } from '../common/result';
import type { Instant } from '../common/time';
import type { DataOrigin } from '../photo/photo';

export interface Memory {
  readonly id: MemoryId;
  readonly tripId: TripId;
  readonly text: string;
  readonly origin: DataOrigin;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
}

export const MEMORY_MAX_CODE_POINTS = 60;

export function countCodePoints(text: string): number {
  return Array.from(text).length;
}

export function createMemory(input: {
  id: string;
  tripId: TripId;
  text: string;
  origin: DataOrigin;
  now: Instant;
}): Result<Memory> {
  const text = input.text.trim();
  const length = countCodePoints(text);
  if (length === 0) {
    return err(domainError('MEMORY_INVALID', '记忆不能为空'));
  }
  if (length > MEMORY_MAX_CODE_POINTS) {
    return err(domainError('MEMORY_INVALID', `记忆不能超过 ${MEMORY_MAX_CODE_POINTS} 个字符`));
  }
  return ok({
    id: input.id as MemoryId,
    tripId: input.tripId,
    text,
    origin: input.origin,
    createdAt: input.now,
    updatedAt: input.now,
  });
}
