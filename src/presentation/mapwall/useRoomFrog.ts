import { useEffect, useRef, useState } from 'react';
import type { LuggageTier } from '../../domain/home/collection';
import type { FrogPerch } from '../../domain/home/perch';
import { nextFrogPose, PERCH_POSE, type FrogPose } from './frog-poses';
import { CHAIR_SEAT, floorAnchor, roomDistance, type RoomPoint } from './room-navigation';
import { planRoomMotion, type MotionKind, type RoomCommand } from './room-motion';

export interface RoomActor {
  readonly position: RoomPoint;
  readonly phase: MotionKind | 'idle' | 'seated';
  readonly pose: FrogPose;
  readonly facing: 'left' | 'right';
  readonly jump: number;
  readonly progress: number;
  readonly perch: FrogPerch | null;
}

export function useRoomFrog(initialPerch: FrogPerch, luggage: LuggageTier, onArrive: (perch: FrogPerch) => void) {
  const [actor, setActor] = useState<RoomActor>(() => ({
    position: initialPerch === 'armchair' ? CHAIR_SEAT : floorAnchor(initialPerch, luggage),
    phase: initialPerch === 'armchair' ? 'seated' : 'idle', pose: PERCH_POSE[initialPerch],
    facing: 'right', jump: 0, progress: 0, perch: initialPerch,
  }));
  const actorRef = useRef(actor);
  const frame = useRef<number | null>(null);
  const queued = useRef<RoomCommand | null>(null);
  const [target, setTarget] = useState<RoomPoint | null>(null);
  const publish = (next: RoomActor) => { actorRef.current = next; setActor(next); };

  useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current); }, []);

  function move(command: RoomCommand): void {
    const current = actorRef.current;
    if (['rise', 'jump-down', 'jump-up', 'sit'].includes(current.phase)) { queued.current = command; return; }
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null; queued.current = null;
    const steps = planRoomMotion(current.position, current.phase === 'seated', command, luggage);
    const end = steps[steps.length - 1]?.to ?? current.position;
    const seated = command.kind === 'perch' && command.perch === 'armchair' && roomDistance(end, CHAIR_SEAT) < 0.05;
    const perch = command.kind === 'perch' && (command.perch !== 'armchair' || seated) ? command.perch : null;
    const finish = () => {
      frame.current = null; setTarget(null);
      publish({ ...actorRef.current, position: end, phase: seated ? 'seated' : 'idle',
        pose: perch ? PERCH_POSE[perch] : 'welcome', jump: 0, progress: 0, perch });
      if (perch) onArrive(perch);
      const pending = queued.current; queued.current = null;
      if (pending) move(pending);
    };
    if (!steps.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { finish(); return; }
    setTarget(end);
    let index = 0; let started: number | null = null;
    const tick = (now: number) => {
      const step = steps[index]!;
      started ??= now;
      const t = Math.min(1, (now - started) / step.duration);
      const jumping = step.kind === 'jump-down' || step.kind === 'jump-up';
      const eased = jumping ? t * t * (3 - 2 * t) : t;
      const dx = step.to.x - step.from.x;
      const next: RoomActor = {
        position: { x: step.from.x + dx * eased, y: step.from.y + (step.to.y - step.from.y) * eased },
        phase: step.kind, pose: step.pose,
        facing: Math.abs(dx) < 0.15 ? actorRef.current.facing : dx < 0 ? 'left' : 'right',
        jump: jumping ? Math.sin(Math.PI * t) * 5.5 : 0, progress: t,
        perch: current.perch,
      };
      publish(next);
      if (t === 1) {
        // A mid-air click changes the next destination after landing, never the jump itself.
        if (step.kind === 'jump-down' && queued.current) {
          const pending = queued.current; queued.current = null;
          publish({ ...next, phase: 'idle', perch: null }); move(pending); return;
        }
        index++; started = now;
        if (index === steps.length) { finish(); return; }
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }

  const changePose = () => {
    const current = actorRef.current;
    if (current.phase !== 'idle' && current.phase !== 'seated') return;
    publish({ ...current, pose: nextFrogPose(current.pose) });
  };
  return { actor, target, move, changePose };
}
