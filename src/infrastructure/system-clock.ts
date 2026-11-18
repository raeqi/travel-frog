import type { Clock } from '../domain/ports';
import type { Instant } from '../domain/common/time';

export class SystemClock implements Clock {
  now(): Instant {
    return Date.now();
  }

  localOffsetMinutes(at: Instant): number {
    return -new Date(at).getTimezoneOffset();
  }
}
