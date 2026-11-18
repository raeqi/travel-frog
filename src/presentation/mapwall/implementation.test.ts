import { describe, expect, it } from "vitest";
import { filesFromEntry, splitBoundaries } from "./import-selection";
import {
  actorInSpace,
  roomGrowth,
  roomToWorld,
  worldToRoom,
} from "./room-space";
import { planRoomMotion } from "./room-motion";
import { CHAIR_SEAT, CHAIR_LANDING, canStandAt } from "./room-navigation";
import type { RoomActor } from "./useRoomFrog";
import type { WallPhoto } from "./model";
import { MISSING_PHOTO, photoImage } from "./usePhotoImages";
import { cityCamera } from "./city-camera";
import { projectWorld, toScreen } from "./geometry";

describe("photograph integrity", () => {
  const personal: WallPhoto = {
    id: "p",
    tripId: "t",
    cityKey: "FRA:巴黎",
    lat: 48.85,
    lng: 2.35,
    capturedAt: 1,
    palette: "sea",
    thumbRef: null,
    inferred: false,
    origin: "user",
  };
  it("never substitutes a scenic demo illustration for a missing personal image", () => {
    expect(photoImage(personal, new Map())).toBe(MISSING_PHOTO);
    expect(photoImage(personal, new Map([["p", "blob:real"]]))).toBe(
      "blob:real",
    );
    expect(photoImage({ ...personal, origin: "demo" }, new Map())).not.toBe(
      MISSING_PHOTO,
    );
  });
});

describe("import selection", () => {
  it("reads every directory batch and nested directory, rather than dropping later batches", async () => {
    const file = (name: string) => ({
      isFile: true,
      isDirectory: false,
      file: (ok: (file: File) => void) => ok({ name } as File),
    });
    const directory = (batches: ReturnType<typeof file>[][]) => ({
      isFile: false,
      isDirectory: true,
      createReader: () => ({
        readEntries: (ok: (entries: ReturnType<typeof file>[]) => void) =>
          ok(batches.shift() ?? []),
      }),
    });
    const nested = directory([[file("inner.jpg")], []]);
    const batches: unknown[][] = [[file("a.jpg"), nested], [file("b.jpg")], []];
    const root = {
      isFile: false,
      isDirectory: true,
      createReader: () => ({
        readEntries: (ok: (entries: unknown[]) => void) =>
          ok(batches.shift() ?? []),
      }),
    };
    expect(
      (await filesFromEntry(root as Parameters<typeof filesFromEntry>[0])).map(
        (f) => f.name,
      ),
    ).toEqual(["a.jpg", "inner.jpg", "b.jpg"]);
  });
  it("offers only boundaries that can produce nonempty sides with duplicate timestamps", () => {
    const photos = new Map([
      ["a", { capturedAt: 10 }],
      ["b", { capturedAt: 10 }],
      ["c", { capturedAt: 20 }],
      ["d", { capturedAt: 30 }],
    ]);
    expect(splitBoundaries(["d", "a", "b", "c"], photos)).toEqual([20, 30]);
    expect(splitBoundaries(["a", "b"], photos)).toEqual([]);
  });
});

describe("shared room space", () => {
  const actor = (
    phase: RoomActor["phase"],
    progress: number,
    position = CHAIR_SEAT,
  ): RoomActor => ({
    position,
    phase,
    progress,
    pose: "mushroom",
    perch: "armchair",
    jump: 0,
    facing: "right",
  });
  it("maps all floor positions reversibly regardless of camera angle", () => {
    for (const point of [CHAIR_LANDING, { x: 12, y: 94 }, { x: 76, y: 96 }]) {
      const world = roomToWorld(point);
      const result = worldToRoom(world.x, world.z);
      expect(result.x).toBeCloseTo(point.x);
      expect(result.y).toBeCloseTo(point.y);
    }
  });
  it("keeps chair landing continuous between seated and floor coordinates", () => {
    expect(actorInSpace(actor("seated", 0))).toEqual(
      actorInSpace(actor("jump-down", 0)),
    );
    expect(actorInSpace(actor("jump-down", 1, CHAIR_LANDING))).toEqual(
      actorInSpace(actor("idle", 0, CHAIR_LANDING)),
    );
    expect(actorInSpace(actor("jump-up", 1))).toEqual(
      actorInSpace(actor("sit", 0)),
    );
  });
  it("keeps wider sofas inside the existing navigation obstacle and still reaches the chair", () => {
    for (const stage of ["base", "settled", "collected"] as const) {
      expect(roomGrowth(stage, 18).seatWidth).toBeLessThan(3.48);
      expect(roomGrowth(stage, 18).cabinets).toBe(3);
      for (const tier of ["small", "standard", "wardrobe"] as const) {
        expect(canStandAt(CHAIR_LANDING, tier)).toBe(true);
        const steps = planRoomMotion(
          { x: 12, y: 94 },
          false,
          { kind: "perch", perch: "armchair" },
          tier,
        );
        expect(steps.at(-1)?.kind).toBe("sit");
        expect(steps.at(-1)?.to).toEqual(CHAIR_SEAT);
      }
    }
  });
});

describe("ordinary city camera", () => {
  it("fits dispersed Paris photos in a city view and handles a single coordinate", () => {
    const photos = [
      { lat: 48.82, lng: 2.3 },
      { lat: 48.9, lng: 2.42 },
    ];
    const camera = cityCamera(photos, photos[0]!, 0.6);
    const metrics = {
      boardW: 1000,
      boardH: 600,
      sheetW: 1000,
      sheetH: 600,
      offX: 0,
      offY: 0,
    };
    for (const photo of photos) {
      const screen = toScreen(
        projectWorld(photo.lat, photo.lng),
        camera,
        metrics,
      );
      expect(screen.x).toBeGreaterThan(50);
      expect(screen.x).toBeLessThan(950);
      expect(screen.y).toBeGreaterThan(50);
      expect(screen.y).toBeLessThan(550);
    }
    expect(Number.isFinite(cityCamera([], photos[0]!, 0.6).zoom)).toBe(true);
  });
});
