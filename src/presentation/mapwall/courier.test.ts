import { describe, expect, it } from 'vitest';
import { courierCurve } from './courier';

describe('courierCurve', () => {
  it('bows the route above the straight line between frog and postcard', () => {
    const d = courierCurve({ x: 100, y: 200 }, { x: 400, y: 220 });
    expect(d.startsWith('M 100.0 200.0 Q ')).toBe(true);
    expect(d.endsWith('400.0 220.0')).toBe(true);
    const controlY = Number(d.split(' ')[5]);
    expect(controlY).toBeLessThan(200);
  });

  it('still produces a curve when the two points coincide', () => {
    const d = courierCurve({ x: 10, y: 10 }, { x: 10, y: 10 });
    expect(d).toContain('Q');
    expect(d.endsWith('10.0 10.0')).toBe(true);
  });
});
