import type { Repositories, UnitOfWork } from '../domain/ports';

/** Application-level gateway: write use cases go through `run`, queries through `read`. */
export interface ArchiveGateway extends UnitOfWork {
  read<T>(work: (repos: Repositories) => Promise<T>): Promise<T>;
  /** Drops every travel-frog record. Used only by the explicit "delete all data" action. */
  clear(): Promise<void>;
}

/** A failure that is safe to show to the user. */
export class AppError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'AppError';
    this.code = code;
  }
}

export function toAppError(error: unknown, fallbackCode: string, fallbackMessage: string): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof Error) {
    const code = 'code' in error && typeof error.code === 'string' ? error.code : fallbackCode;
    return new AppError(code, error.message || fallbackMessage);
  }
  return new AppError(fallbackCode, fallbackMessage);
}
