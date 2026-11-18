export interface CourierPoint {
  readonly x: number;
  readonly y: number;
}

/** How long the dotted courier line and envelope stay on the map. */
export const COURIER_MS = 1700;

/**
 * A bowed dotted route. The control point lifts above the straight line so the
 * envelope reads as travelling, whether the frog is sending or the stamp returns.
 */
export function courierCurve(from: CourierPoint, to: CourierPoint): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const lift = Math.min(96, Math.max(36, len * 0.28));
  const cx = (from.x + to.x) / 2 - (dy / len) * lift * 0.2;
  const cy = (from.y + to.y) / 2 - lift;
  return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
