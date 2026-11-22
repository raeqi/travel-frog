import type { Metrics } from './geometry';

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface PilePlacement {
  readonly cityKey: string;
  readonly photoIds: readonly string[];
  readonly sx: number;
  readonly sy: number;
  readonly year: number;
  readonly title: string;
  readonly long: boolean;
}

export interface LabelPlacement {
  readonly cityKey: string;
  readonly name: string;
  readonly year: number;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly count: number;
  readonly twoLine: boolean;
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function overlapArea(a: Rect, b: Rect): number {
  if (!overlaps(a, b)) return 0;
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w * h;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function inside(rect: Rect, metrics: Metrics, margin = 10): boolean {
  return rect.x >= margin && rect.y >= margin && rect.x + rect.w <= metrics.boardW - margin && rect.y + rect.h <= metrics.boardH - margin;
}

export interface LabelInput {
  readonly piles: readonly PilePlacement[];
  readonly wishRects: readonly Rect[];
  readonly frogPos: Point | null;
  readonly metrics: Metrics;
  readonly level: 'world' | 'country' | 'city' | 'region';
  readonly photoCount: number;
}

/**
 * Deterministic label avoidance. Each pile starts with the same candidate slots as
 * the prototype, then the first non-overlapping slot wins.
 */
export function placeLabels(input: LabelInput): LabelPlacement[] {
  if (input.level === 'city') return [];
  const dense = input.photoCount > 500;
  const max = dense ? 6 : input.level === 'world' ? 10 : 8;
  const obstacles: Rect[] = input.piles.map((pile) => ({
    x: pile.sx - 36,
    y: pile.sy - 34,
    w: 72,
    h: 68,
  }));
  for (const rect of input.wishRects) {
    obstacles.push({ x: rect.x - 4, y: rect.y - 4, w: rect.w + 8, h: rect.h + 8 });
  }
  if (input.frogPos) {
    obstacles.push({ x: input.frogPos.x - 32, y: input.frogPos.y - 31, w: 64, h: 62 });
  }

  const placed: Rect[] = [];
  const items = input.piles.slice().sort((a, b) => b.photoIds.length - a.photoIds.length);
  const out: LabelPlacement[] = [];

  for (const pile of items) {
    if (out.length >= max) break;
    if (dense && pile.photoIds.length < 8) continue;
    const width = Math.min(184, pile.title.length * 13 + 48);
    const twoLine = pile.long || pile.title.length > 9;
    const height = twoLine ? 48 : 36;
    const candidates: Point[] = [
      { x: pile.sx + 42, y: pile.sy - height / 2 },
      { x: pile.sx - 42 - width, y: pile.sy - height / 2 },
      { x: pile.sx - width / 2, y: pile.sy + 46 },
      { x: pile.sx - width / 2, y: pile.sy - 46 - height },
      { x: pile.sx - 40 - width, y: pile.sy - 30 - height },
      { x: pile.sx + 40, y: pile.sy - 30 - height },
      { x: pile.sx - 40 - width, y: pile.sy + 30 },
      { x: pile.sx + 40, y: pile.sy + 30 },
      { x: pile.sx + 58, y: pile.sy - height / 2 },
      { x: pile.sx - 58 - width, y: pile.sy - height / 2 },
      { x: pile.sx - width / 2, y: pile.sy + 72 },
      { x: pile.sx - width / 2, y: pile.sy - 72 - height },
      { x: pile.sx - 62 - width, y: pile.sy - 54 - height },
      { x: pile.sx + 62, y: pile.sy - 54 - height },
      { x: pile.sx - 62 - width, y: pile.sy + 54 },
      { x: pile.sx + 62, y: pile.sy + 54 },
    ];

    let spot: { point: Point; rect: Rect } | null = null;
    for (const candidate of candidates) {
      const rect: Rect = {
        x: candidate.x - 4,
        y: candidate.y - 2,
        w: width + 8,
        h: height + 4,
      };
      if (!inside(rect, input.metrics)) continue;
      if (obstacles.some((obstacle) => overlaps(rect, obstacle))) continue;
      if (placed.some((other) => overlaps(rect, other))) continue;
      spot = { point: candidate, rect };
      break;
    }
    if (!spot) continue;
    placed.push(spot.rect);
    out.push({
      cityKey: pile.cityKey,
      name: pile.title,
      year: pile.year,
      x: spot.point.x,
      y: spot.point.y,
      w: width,
      h: height,
      count: pile.photoIds.length,
      twoLine,
    });
  }
  return out;
}

export interface FrogPlacementInput {
  readonly anchor: Point | null;
  readonly piles: readonly PilePlacement[];
  readonly photoPoints: readonly Point[];
  readonly level: 'world' | 'country' | 'city' | 'region';
  readonly mode: 'world' | 'city' | 'region';
  readonly metrics: Metrics;
}

export function placeFrog(input: FrogPlacementInput): Point | null {
  const anchor = input.anchor;
  if (!anchor || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) return null;

  const obstacles: Rect[] = [];
  let ownPile: PilePlacement | null = null;
  let ownDistance = 60;
  if (input.level !== 'city') {
    for (const pile of input.piles) {
      const distance = Math.hypot(pile.sx - anchor.x, pile.sy - anchor.y);
      if (distance < ownDistance) {
        ownDistance = distance;
        ownPile = pile;
      }
    }
  }
  for (const pile of input.piles) {
    if (input.level !== 'city' && pile === ownPile) continue;
    obstacles.push({ x: pile.sx - 39, y: pile.sy - 37, w: 78, h: 74 });
  }
  if (input.mode === 'city') {
    for (const point of input.photoPoints) {
      obstacles.push({ x: point.x - 26, y: point.y - 25, w: 52, h: 50 });
    }
  }

  const small = input.level === 'world';
  const W = small ? 48 : 60;
  const H = small ? 46 : 58;
  const ox = small ? 66 : 78;
  const oy = 46;
  const offsets: Point[] =
    input.level === 'city'
      ? [
          { x: ox, y: oy },
          { x: ox, y: -oy + 2 },
          { x: -ox, y: oy },
          { x: -ox, y: -oy + 2 },
          { x: ox + 12, y: 0 },
          { x: -ox - 12, y: 0 },
          { x: 0, y: oy + 34 },
          { x: 0, y: -oy - 34 },
        ]
      : [
          ownPile
            ? { x: ownPile.sx - anchor.x, y: ownPile.sy + 37 + H / 2 + 6 - anchor.y }
            : { x: 0, y: oy + 4 },
          { x: 0, y: -oy - 8 },
          { x: ox, y: oy },
          { x: ox, y: -oy + 2 },
          { x: -ox, y: oy },
          { x: -ox, y: -oy + 2 },
          { x: ox + 12, y: 0 },
          { x: -ox - 12, y: 0 },
        ];

  let best: { x: number; y: number; clash: number; distance: number } | null = null;
  for (const offset of offsets) {
    const cx = clamp(anchor.x + offset.x, input.metrics.offX + W / 2 + 6, input.metrics.offX + input.metrics.sheetW - W / 2 - 6);
    const cy = clamp(anchor.y + offset.y, input.metrics.offY + H / 2 + 6, input.metrics.offY + input.metrics.sheetH - H / 2 - 6);
    const rect: Rect = { x: cx - W / 2, y: cy - H / 2, w: W, h: H };
    const clash = obstacles.filter((obstacle) => overlaps(rect, obstacle)).length;
    const distance = Math.abs(cx - anchor.x) + Math.abs(cy - anchor.y);
    if (!best || clash < best.clash || (clash === best.clash && distance < best.distance)) {
      best = { x: cx, y: cy, clash, distance };
    }
    if (clash === 0) break;
  }
  return best ? { x: best.x, y: best.y } : null;
}

export interface WishPlacementInput {
  readonly obstacles?: readonly Rect[];
  readonly anchor: Point;
  readonly width: number;
  readonly height: number;
  readonly piles: readonly PilePlacement[];
  readonly placed: readonly Rect[];
  readonly frogRect: Rect | null;
  readonly metrics: Metrics;
}

export interface WishPlacement {
  readonly cx: number;
  readonly cy: number;
  readonly rect: Rect;
}

export function placeWish(input: WishPlacementInput): WishPlacement {
  const { width: W, height: H, metrics } = input;
  const bx = W / 2 + 16;
  const by = H / 2 + 14;
  const offsets: Point[] = [];
  for (const mul of [1, 1.6, 2.3, 3.05]) {
    for (let angle = 0; angle < 8; angle += 1) {
      const rad = (angle * 45 * Math.PI) / 180;
      offsets.push({ x: Math.cos(rad) * bx * mul, y: Math.sin(rad) * by * mul });
    }
  }

  let best: { cx: number; cy: number; rect: Rect; overlap: number; distance: number } | null = null;
  for (const offset of offsets) {
    const cx = clamp(input.anchor.x + offset.x, metrics.offX + W / 2 + 4, metrics.offX + metrics.sheetW - W / 2 - 4);
    const cy = clamp(input.anchor.y + offset.y, metrics.offY + H / 2 + 4, metrics.offY + metrics.sheetH - H / 2 - 4);
    const rect: Rect = { x: cx - W / 2, y: cy - H / 2, w: W, h: H };
    let overlap = 0;
    for (const pile of input.piles) {
      overlap += overlapArea(rect, { x: pile.sx - 38, y: pile.sy - 37, w: 76, h: 74 });
    }
    for (const other of input.placed) overlap += overlapArea(rect, other);
    for (const other of input.obstacles??[]) overlap += overlapArea(rect,other);
    if (input.frogRect) overlap += overlapArea(rect, input.frogRect);
    const distance = Math.abs(cx - input.anchor.x) + Math.abs(cy - input.anchor.y);
    if (!best || overlap < best.overlap || (overlap === best.overlap && distance < best.distance)) {
      best = { cx, cy, rect, overlap, distance };
    }
    if (overlap === 0) break;
  }
  return best ?? { cx: input.anchor.x, cy: input.anchor.y, rect: { x: input.anchor.x - W / 2, y: input.anchor.y - H / 2, w: W, h: H } };
}

export interface ActionsPlacementInput {
  readonly frogPos: Point;
  readonly obstacles: readonly Rect[];
  readonly metrics: Metrics;
}

export interface ActionsPlacement {
  readonly x: number;
  readonly y: number;
  readonly below: boolean;
}

export function placeFrogActions(input: ActionsPlacementInput): ActionsPlacement {
  const W = 102;
  const H = 40;
  const offsets: Point[] = [
    { x: 0, y: -44 },
    { x: 92, y: -38 },
    { x: -92, y: -38 },
    { x: 82, y: -44 },
    { x: -82, y: -44 },
    { x: 82, y: 0 },
    { x: -82, y: 0 },
    { x: 0, y: 48 },
    { x: 82, y: 48 },
    { x: -82, y: 48 },
  ];
  let best: { x: number; y: number; clash: number; below: boolean } | null = null;
  for (const offset of offsets) {
    const cx = clamp(input.frogPos.x + offset.x, input.metrics.offX + W / 2 + 6, input.metrics.offX + input.metrics.sheetW - W / 2 - 6);
    const cy = clamp(input.frogPos.y + offset.y, input.metrics.offY + H / 2 + 6, input.metrics.offY + input.metrics.sheetH - H / 2 - 6);
    const rect: Rect = { x: cx - W / 2, y: cy - H / 2, w: W, h: H };
    const clash = input.obstacles.filter((obstacle) => overlaps(rect, obstacle)).length;
    const below = offset.y > 0;
    if (!best || clash < best.clash) best = { x: cx, y: cy, clash, below };
    if (clash === 0) break;
  }
  return best ?? { x: input.frogPos.x, y: input.frogPos.y, below: false };
}

export interface BubblePlacement {
  readonly x: number;
  readonly y: number;
  readonly flip: boolean;
}

export function placeBubble(frogPos: Point, boardW: number, width = 224): BubblePlacement {
  let x = frogPos.x + 32;
  let y = frogPos.y - 30;
  let flip = false;
  if (x + width > boardW - 12) {
    x = frogPos.x - 32 - width;
    flip = true;
  }
  if (x < 12) {
    x = 12;
    y = frogPos.y + 34;
  }
  if (y < 10) y = frogPos.y + 34;
  return { x, y, flip };
}
