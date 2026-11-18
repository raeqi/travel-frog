import { describe, expect, it } from 'vitest';
import type { LuggageTier } from '../../domain/home/collection';
import { canStandAt, canWalkSegment, CHAIR_LANDING, CHAIR_SEAT, floorAnchor, planFloorPath, roomDistance } from './room-navigation';
import { planRoomMotion } from './room-motion';

describe.each<LuggageTier>(['small', 'standard', 'wardrobe'])('room navigation with %s luggage', luggage => {
  it('reaches both sides and the rear aisle without crossing furniture', () => {
    const points = [floorAnchor('fireplace-rug', luggage), floorAnchor('curio', luggage), floorAnchor('bookshelf', luggage), floorAnchor('suitcase', luggage), floorAnchor('footstool', luggage), { x: 50, y: 97 }];
    for (const target of points) {
      const path = planFloorPath(CHAIR_LANDING, target, luggage);
      expect(roomDistance(path[path.length - 1]!, target), JSON.stringify({ luggage, target, path })).toBeLessThan(0.1);
      expect(path.every(point => canStandAt(point, luggage))).toBe(true);
      for (let i = 1; i < path.length; i++) expect(canWalkSegment(path[i - 1]!, path[i]!, luggage)).toBe(true);
    }
  });

  it('projects a blocked point onto reachable floor and handles invalid coordinates', () => {
    const path = planFloorPath(CHAIR_LANDING, { x: 45, y: 86 }, luggage);
    expect(canStandAt({ x: 45, y: 86 }, luggage)).toBe(false);
    expect(canStandAt(path[path.length - 1]!, luggage)).toBe(true);
    expect(roomDistance(path[path.length - 1]!, { x: 45, y: 86 })).toBeGreaterThan(1);
    expect(planFloorPath(CHAIR_LANDING, { x: NaN, y: 10 }, luggage)).toEqual([CHAIR_LANDING]);
  });

  it('collides with the luggage feet while allowing floor behind its tall silhouette', () => {
    expect(canStandAt({ x: 94, y: 80 }, luggage)).toBe(true);
    expect(canStandAt({ x: luggage === 'small' ? 86 : 90, y: 92 }, luggage)).toBe(false);
  });

  it('can return to the chair from a re-targeted point halfway along a route', () => {
    const outward = planFloorPath(CHAIR_LANDING, { x: 12, y: 89 }, luggage);
    const a = outward[0]!; const b = outward[1]!;
    const halfway = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const back = planFloorPath(halfway, CHAIR_LANDING, luggage);
    expect(back[0]).toEqual(halfway);
    expect(back[back.length - 1]).toEqual(CHAIR_LANDING);
  });
});

describe('chair transitions', () => {
  it('stands up and lands before following the floor path', () => {
    const steps = planRoomMotion(CHAIR_SEAT, true, { kind: 'floor', point: { x: 12, y: 89 } }, 'standard');
    expect(steps[0]?.kind).toBe('rise');
    expect(steps[1]).toMatchObject({ kind: 'jump-down', from: CHAIR_SEAT, to: CHAIR_LANDING });
    expect(steps[2]?.from).toEqual(CHAIR_LANDING);
    for (let i = 1; i < steps.length; i++) expect(steps[i]?.from).toEqual(steps[i - 1]?.to);
  });

  it('approaches the chair on the floor, jumps up and settles in the seat', () => {
    const steps = planRoomMotion({ x: 12, y: 89 }, false, { kind: 'perch', perch: 'armchair' }, 'standard');
    expect(steps.at(-2)).toMatchObject({ kind: 'jump-up', from: CHAIR_LANDING, to: CHAIR_SEAT });
    expect(steps.at(-1)).toMatchObject({ kind: 'sit', to: CHAIR_SEAT, pose: 'mushroom' });
    expect(planRoomMotion(CHAIR_SEAT, true, { kind: 'perch', perch: 'armchair' }, 'standard')).toEqual([]);
    // An invalid, disconnected start must not manufacture a jump from across the room.
    expect(planRoomMotion({ x: 0, y: 0 }, false, { kind: 'perch', perch: 'armchair' }, 'standard')).toEqual([]);
  });
});
