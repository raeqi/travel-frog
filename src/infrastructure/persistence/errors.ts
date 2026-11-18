export type StorageErrorCode = 'STORAGE_FAILED' | 'STORAGE_QUOTA_EXCEEDED' | 'DB_OPEN_FAILED' | 'MIGRATION_FAILED' | 'NOT_SUPPORTED' | 'WRITE_CONFLICT';

export class StorageError extends Error {
  readonly code: StorageErrorCode;
  readonly reason: unknown;

  constructor(code: StorageErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
    this.reason = cause;
  }
}

export function toStorageError(error: unknown): StorageError {
  if (error instanceof StorageError) return error;
  if (error instanceof DOMException) {
    if (error.name === 'QuotaExceededError') {
      return new StorageError('STORAGE_QUOTA_EXCEEDED', '本地存储空间不足', error);
    }
    return new StorageError('STORAGE_FAILED', `本地存储写入失败（${error.name}）`, error);
  }
  const message = error instanceof Error ? error.message : String(error);
  return new StorageError('STORAGE_FAILED', message, error);
}
