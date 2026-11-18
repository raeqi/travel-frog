import type { LuggageTier } from '../../domain/home/collection';
import type { FrogPerch } from '../../domain/home/perch';
import type { FrogPose } from './frog-poses';
import { CHAIR_LANDING, CHAIR_SEAT, floorAnchor, planFloorPath, roomDistance, type RoomPoint } from './room-navigation';

export type RoomCommand = { readonly kind: 'floor'; readonly point: RoomPoint } | { readonly kind: 'perch'; readonly perch: FrogPerch };
export type MotionKind = 'rise' | 'jump-down' | 'walk' | 'jump-up' | 'sit';
export interface RoomMotionStep {
  readonly kind: MotionKind;
  readonly from: RoomPoint;
  readonly to: RoomPoint;
  readonly duration: number;
  readonly pose: FrogPose;
}

export function planRoomMotion(from: RoomPoint, seated: boolean, command: RoomCommand, luggage: LuggageTier): readonly RoomMotionStep[] {
  if (seated && command.kind === 'perch' && command.perch === 'armchair') return [];
  const steps: RoomMotionStep[] = [];
  let start = from;
  if (seated) {
    steps.push({ kind: 'rise', from, to: from, duration: 220, pose: 'front' });
    steps.push({ kind: 'jump-down', from, to: CHAIR_LANDING, duration: 540, pose: 'walk' });
    start = CHAIR_LANDING;
  }
  const chair = command.kind === 'perch' && command.perch === 'armchair';
  const destination = command.kind === 'floor' ? command.point : chair ? CHAIR_LANDING : floorAnchor(command.perch as Exclude<FrogPerch, 'armchair'>, luggage);
  const path = planFloorPath(start, destination, luggage);
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!; const b = path[i]!;
    if (roomDistance(a, b) < 0.05) continue;
    steps.push({ kind: 'walk', from: a, to: b, duration: Math.max(100, roomDistance(a, b) / 17 * 1000), pose: 'walk' });
  }
  if (chair && roomDistance(path[path.length - 1]!, CHAIR_LANDING) < 0.05) {
    steps.push({ kind: 'jump-up', from: CHAIR_LANDING, to: CHAIR_SEAT, duration: 560, pose: 'walk' });
    steps.push({ kind: 'sit', from: CHAIR_SEAT, to: CHAIR_SEAT, duration: 260, pose: 'mushroom' });
  }
  return steps;
}
