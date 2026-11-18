import type { Instant } from '../../domain/common/time';
import type { Logger } from '../../domain/ports';

interface LogLine {
  at: Instant;
  level: string;
  event: string;
  fields: Record<string, unknown>;
}

const CAPACITY = 500;

/** Keeps the last 500 structured lines in memory; nothing is written to disk or sent anywhere. */
export class RingBufferLogger implements Logger {
  private readonly lines: LogLine[] = [];

  private push(level: string, event: string, fields: Record<string, unknown> = {}): void {
    this.lines.push({ at: Date.now(), level, event, fields });
    if (this.lines.length > CAPACITY) this.lines.splice(0, this.lines.length - CAPACITY);
  }

  debug(event: string, fields?: Record<string, unknown>): void {
    this.push('debug', event, fields);
  }

  warn(event: string, fields?: Record<string, unknown>): void {
    this.push('warn', event, fields);
  }

  error(event: string, error: unknown, fields?: Record<string, unknown>): void {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    this.push('error', event, { ...fields, message });
  }

  recent(limit: number): readonly LogLine[] {
    return this.lines.slice(-limit);
  }
}
