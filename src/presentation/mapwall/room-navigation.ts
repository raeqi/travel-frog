import type { LuggageTier } from '../../domain/home/collection';
import type { FrogPerch } from '../../domain/home/perch';

/** Foot positions in the room plate's 0–100 coordinates, independent of viewport size. */
export interface RoomPoint { readonly x: number; readonly y: number }
type Polygon = readonly RoomPoint[];
const polygon = (values: readonly (readonly [number, number])[]): Polygon => values.map(([x, y]) => ({ x, y }));

export const ROOM_FLOOR = polygon([[3, 83], [28, 70], [33, 65], [47, 68], [52, 76], [69, 82], [78, 77], [98.5, 76], [98.5, 98.5], [3, 98.5]]);
export const CHAIR_SEAT: RoomPoint = { x: 64.5, y: 69.5 };
export const CHAIR_LANDING: RoomPoint = { x: 73, y: 90.5 };
const ANCHORS: Readonly<Record<Exclude<FrogPerch, 'armchair'>, RoomPoint>> = {
  'fireplace-rug': { x: 12, y: 89 }, curio: { x: 41, y: 73 },
  bookshelf: { x: 47.5, y: 73 }, suitcase: { x: 76, y: 94 }, footstool: { x: 77, y: 87 },
};

const STATIC_OBSTACLES = [
  polygon([[0, 0], [28, 0], [28, 80], [20, 84], [0, 86]]),
  polygon([[33, 0], [47, 0], [47, 71.5], [33, 71.5]]),
  polygon([[50, 0], [79, 0], [79, 82], [70, 87.5], [50, 78]]),
  // The ground footprint is below the tabletop; the narrow rear aisle stays open.
  polygon([[23, 85], [30, 81], [40, 81], [53, 83], [63, 89], [64, 92], [60, 95], [28, 95], [24, 92]]),
  polygon([[84, 77], [90, 77], [91, 80], [84, 81]]),
];
const LUGGAGE_OBSTACLES: Readonly<Record<LuggageTier, Polygon>> = {
  small: polygon([[82, 88.5], [89, 88.5], [89, 93.2], [82, 93.2]]),
  standard: polygon([[81.5, 84], [94, 84], [94, 93.2], [81.5, 93.2]]),
  wardrobe: polygon([[83, 85], [96, 85], [96, 95.5], [83, 95.5]]),
};

function inside(point: RoomPoint, shape: Polygon): boolean {
  let hit = false;
  for (let i = 0, j = shape.length - 1; i < shape.length; j = i++) {
    const a = shape[i]!; const b = shape[j]!;
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

/** The projected foot ellipse, rather than the character's transparent square, collides. */
export function canStandAt(point: RoomPoint, luggage: LuggageTier): boolean {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !inside(point, ROOM_FLOOR)) return false;
  return ![...STATIC_OBSTACLES, LUGGAGE_OBSTACLES[luggage]].some(shape =>
    [[0, 0], [-1.2, 0], [1.2, 0], [0, -0.75], [0, 0.75], [-0.85, -0.5], [0.85, -0.5], [-0.85, 0.5], [0.85, 0.5]]
      .some(([dx, dy]) => inside({ x: point.x + dx!, y: point.y + dy! }, shape)),
  );
}

export function roomDistance(a: RoomPoint, b: RoomPoint): number {
  return Math.hypot(a.x - b.x, (a.y - b.y) * 9 / 16);
}

export function canWalkSegment(a: RoomPoint, b: RoomPoint, luggage: LuggageTier): boolean {
  const samples = Math.max(1, Math.ceil(roomDistance(a, b) / 0.25));
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    if (!canStandAt({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, luggage)) return false;
  }
  return true;
}

interface NavNode { readonly point: RoomPoint; readonly edges: readonly number[] }
const graphs = new Map<LuggageTier, readonly NavNode[]>();
function graphFor(luggage: LuggageTier): readonly NavNode[] {
  const cached = graphs.get(luggage); if (cached) return cached;
  const points: RoomPoint[] = []; const keys = new Map<string, number>();
  for (let y = 65; y <= 98; y++) for (let x = 3; x <= 98; x++) {
    const point = { x, y }; if (!canStandAt(point, luggage)) continue;
    keys.set(`${x},${y}`, points.length); points.push(point);
  }
  const graph = points.map(point => {
    const edges: number[] = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const neighbor = keys.get(`${point.x + dx},${point.y + dy}`);
      if (neighbor !== undefined && canWalkSegment(point, points[neighbor]!, luggage)) edges.push(neighbor);
    }
    return { point, edges };
  });
  graphs.set(luggage, graph); return graph;
}

export function floorAnchor(perch: Exclude<FrogPerch, 'armchair'>, luggage: LuggageTier): RoomPoint {
  const wanted = ANCHORS[perch];
  if (canStandAt(wanted, luggage)) return wanted;
  return graphFor(luggage).reduce((best, node) => roomDistance(node.point, wanted) < roomDistance(best, wanted) ? node.point : best, CHAIR_LANDING);
}

/** Dijkstra also finds the nearest reachable floor when a target is obstructed.
 *  Smoothing samples every segment, so corners cannot cut through furniture. */
export function planFloorPath(from: RoomPoint, wanted: RoomPoint, luggage: LuggageTier): readonly RoomPoint[] {
  if (!Number.isFinite(wanted.x) || !Number.isFinite(wanted.y)) return [from];
  if (canWalkSegment(from, wanted, luggage)) return roomDistance(from, wanted) < 0.05 ? [from] : [from, wanted];
  const graph = graphFor(luggage);
  const distances = graph.map(() => Infinity); const parents = graph.map(() => -1); const visited = new Set<number>();
  const queue: number[] = [];
  graph.forEach((node, index) => {
    if (roomDistance(from, node.point) < 2 && canWalkSegment(from, node.point, luggage)) {
      distances[index] = roomDistance(from, node.point); queue.push(index);
    }
  });
  if (!queue.length) return [from];
  let best = queue[0]!;
  while (queue.length) {
    queue.sort((a, b) => distances[b]! - distances[a]!);
    const current = queue.pop()!; if (visited.has(current)) continue; visited.add(current);
    if (roomDistance(graph[current]!.point, wanted) < roomDistance(graph[best]!.point, wanted)) best = current;
    for (const neighbor of graph[current]!.edges) {
      const cost = distances[current]! + roomDistance(graph[current]!.point, graph[neighbor]!.point);
      if (cost < distances[neighbor]!) { distances[neighbor] = cost; parents[neighbor] = current; queue.push(neighbor); }
    }
  }
  const points = [graph[best]!.point];
  for (let parent = parents[best]!; parent >= 0; parent = parents[parent]!) points.unshift(graph[parent]!.point);
  points.unshift(from);
  if (canStandAt(wanted, luggage) && canWalkSegment(points[points.length - 1]!, wanted, luggage)) points.push(wanted);
  const smooth: RoomPoint[] = [from]; let i = 0;
  while (i < points.length - 1) {
    let end = points.length - 1;
    while (end > i + 1 && !canWalkSegment(points[i]!, points[end]!, luggage)) end--;
    smooth.push(points[end]!); i = end;
  }
  return smooth;
}
