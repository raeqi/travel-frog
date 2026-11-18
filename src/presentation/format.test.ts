import { describe, expect, it } from 'vitest';
import { fmtLocalDate, fmtLocalRange, fmtLocalTime } from './format';

describe('capture-time formatting', () => {
  it('shifts a UTC instant into the recorded EXIF offset', () => {
    const utc = Date.UTC(2025, 4, 2, 1, 0);
    expect(fmtLocalDate(utc, 540)).toBe('2025-05-02');
    expect(fmtLocalTime(utc, 540)).toBe('10:00');
  });

  it('falls back to UTC when the offset is unknown', () => {
    const utc = Date.UTC(2025, 4, 2, 1, 0);
    expect(fmtLocalDate(utc, null)).toBe('2025-05-02');
    expect(fmtLocalTime(utc, null)).toBe('01:00');
  });

  it('renders ranges in the capture timezone, including the trailing day', () => {
    const range = { start: Date.UTC(2025, 4, 1, 15, 0), end: Date.UTC(2025, 4, 3, 15, 0) };
    expect(fmtLocalRange(range, 540)).toBe('2025-05-02 → 05-03');
    expect(fmtLocalRange(range, null)).toBe('2025-05-01 → 05-03');
  });
});
