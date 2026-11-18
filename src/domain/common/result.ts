export type Result<T, E = DomainError> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function mapResult<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return result.ok ? ok(fn(result.value)) : result;
}

export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  return result.ok ? result.value : fallback;
}

export interface DomainError {
  readonly code: DomainErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, string | number | boolean>>;
}

export type DomainErrorCode =
  | 'VALIDATION_FAILED'
  | 'DUPLICATE_ID'
  | 'PHOTO_ALREADY_ASSIGNED'
  | 'PHOTO_NOT_FOUND'
  | 'VISIT_ORPHANED'
  | 'VISIT_ORDER_INVALID'
  | 'TRIP_TIME_OVERLAP'
  | 'TRIP_RANGE_INVALID'
  | 'TRIP_NOT_FOUND'
  | 'EMPTY_TRIP'
  | 'CITY_DUPLICATE'
  | 'MEMORY_INVALID'
  | 'CANDIDATE_PHOTO_CONFLICT'
  | 'CANDIDATE_NOT_PENDING'
  | 'CANDIDATE_NOT_FOUND'
  | 'CANDIDATE_EMPTY'
  | 'CANDIDATE_RESTORE_CONFLICT'
  | 'TIME_RANGE_INVALID'
  | 'GEO_INVALID'
  | 'WISH_STATE_INVALID'
  | 'MANUAL_VISIT_DUPLICATE'
  | 'ORIGIN_MIXED'
  | 'CASCADE_INVALID'
  | 'CONFIG_INVALID'
  | 'MERGE_SAME_CANDIDATE'
  | 'MERGE_TOO_LONG'
  | 'SPLIT_AT_BOUNDARY'
  | 'SPLIT_EMPTY_SIDE'
  | 'LOCATION_INVALID'
  | 'DUPLICATE_PHOTO'
  | 'INVALID_INPUT';

export function domainError(
  code: DomainErrorCode,
  message: string,
  details?: Readonly<Record<string, string | number | boolean>>,
): DomainError {
  return details ? { code, message, details } : { code, message };
}

export class DomainViolation extends Error {
  readonly error: DomainError;

  constructor(error: DomainError) {
    super(`${error.code}: ${error.message}`);
    this.name = 'DomainViolation';
    this.error = error;
  }
}
