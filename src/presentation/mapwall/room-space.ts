import type { FurnitureStage, LuggageTier } from "../../domain/home/collection";
import type { RoomActor } from "./useRoomFrog";
import type { RoomPoint } from "./room-navigation";

/** One floor coordinate system for the painted room, paths and spatial view. */
export function roomToWorld(point: RoomPoint): { x: number; z: number } {
  return { x: (point.x - 50) * 0.12, z: (point.y - 80) * 0.25 };
}
export function worldToRoom(x: number, z: number): RoomPoint {
  return { x: x / 0.12 + 50, y: z / 0.25 + 80 };
}
export function actorInSpace(actor: RoomActor): {
  x: number;
  y: number;
  z: number;
} {
  const point = roomToWorld(actor.position);
  const chairWeight =
    actor.phase === "jump-down"
      ? 1 - actor.progress
      : actor.phase === "jump-up"
        ? actor.progress
        : ["seated", "rise", "sit"].includes(actor.phase)
          ? 1
          : 0;
  return {
    ...point,
    y: chairWeight * 1.05 + actor.jump * 0.12,
    z: point.z + chairWeight * 1.875,
  };
}
/** Seat growth stays inside the existing chair obstacle: paths never cross a wider arm. */
export function roomGrowth(stage: FurnitureStage, awards: number) {
  return {
    seatWidth: stage === "collected" ? 3.3 : stage === "settled" ? 2.7 : 2.1,
    cabinets: Math.max(1, Math.ceil(awards / 8)),
    expanded: stage !== "base",
  };
}
export function luggageBounds(tier: LuggageTier) {
  return tier === "wardrobe"
    ? { width: 1.4, depth: 1.1, height: 1.8 }
    : tier === "standard"
      ? { width: 1.3, depth: 0.9, height: 0.75 }
      : { width: 0.75, depth: 0.65, height: 0.55 };
}
