/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { TravelFrogService } from "./travel-frog-service";
import { openDatabase } from "../infrastructure/persistence/idb/database";
import { IdbUnitOfWork } from "../infrastructure/persistence/idb/unit-of-work";
import { BrowserExifReader } from "../infrastructure/exif/exif-reader.browser";
import { BrowserFingerprintReader } from "../infrastructure/media/fingerprint.browser";
import { CanvasThumbnailGenerator } from "../infrastructure/media/thumbnail-generator.browser";
import { GazetteerCityResolver } from "../infrastructure/geo/city-resolver";
import { CryptoIdGenerator } from "../infrastructure/crypto-id-generator";
import { RingBufferLogger } from "../infrastructure/logging/ring-buffer-logger";

// Synthetic JPEG pixels and real EXIF, generated for QA; no user photographs.
const files = [1, 2, 3].map(
  (n) =>
    new File(
      [
        new Uint8Array(
          readFileSync(new URL(`./fixtures/paris-${n}.jpg`, import.meta.url)),
        ),
      ],
      `paris-${n}.jpg`,
      { type: "image/jpeg", lastModified: Date.UTC(2020, 4, n + 1) },
    ),
);
describe("real JPEG import, confirmation and database reopening", () => {
  it("keeps photos, original metadata, fulfilled card and PR6 journey across a fresh service/database connection", async () => {
    const factory = new IDBFactory(),
      now = Date.UTC(2026, 10, 18),
      clock = { now: () => now, localOffsetMinutes: () => 0 };
    const edges: number[] = [],
      decoder = new CanvasThumbnailGenerator();
    const open = async () => {
      const db = await openDatabase(factory, now);
      const service = new TravelFrogService({
        gateway: new IdbUnitOfWork(db),
        clock,
        ids: new CryptoIdGenerator(),
        exif: new BrowserExifReader(),
        fingerprints: new BrowserFingerprintReader(),
        cityResolver: new GazetteerCityResolver(),
        logger: new RingBufferLogger(),
        thumbnails: {
          async create(file, edge) {
            edges.push(edge);
            return decoder.create(file, edge);
          },
        },
      });
      await service.load();
      return { db, service };
    };
    const first = await open(),
      service = first.service;
    const id = await service.addWish({ name: "巴黎", region: "法国" });
    await service.deliverWish(id, {
      note: "QA合成来信，验证真实照片兑现与保留",
    });
    await service.setWishStatus(id, "stamped");
    const journey = structuredClone(service.getSnapshot().frogTravel);
    const stages: string[] = [];
    const summary = await service.importFiles(files, (p) => {
      if (p.stage) stages.push(p.stage);
    });
    expect(summary.imported).toBe(3);
    expect(summary.failed).toBe(0);
    expect(edges).toEqual([2048, 2048, 2048]);
    expect(stages).toEqual(
      expect.arrayContaining([
        "metadata",
        "preview",
        "candidates",
        "saving",
        "completed",
      ]),
    );
    const candidate = service
      .getSnapshot()
      .candidates.find((c) => c.status === "pending")!;
    expect(candidate.photoIds).toHaveLength(3);
    const trip = await service.confirmCandidate(candidate.id);
    const photos = structuredClone(service.getSnapshot().photos);
    expect(
      photos.every(
        (p) =>
          p.tripId === trip &&
          p.geo !== null &&
          p.capturedAtSource === "exif-original",
      ),
    ).toBe(true);
    expect(photos[0]?.geo?.lat).toBeCloseTo(48.85, 1);
    expect(service.getSnapshot().wishes.find((w) => w.id === id)?.status).toBe(
      "fulfilled",
    );
    expect(service.getSnapshot().frogTravel).toEqual(journey);
    first.db.close();
    const reopened = await open(),
      restored = reopened.service.getSnapshot();
    expect(restored.photos).toEqual(photos);
    expect(restored.trips.map((t) => t.id)).toContain(trip);
    expect(restored.candidates.find((c) => c.id === candidate.id)?.status).toBe(
      "confirmed",
    );
    expect(restored.wishes.find((w) => w.id === id)?.status).toBe("fulfilled");
    expect(restored.frogTravel).toEqual(journey);
    expect((await reopened.service.importFiles(files)).needsRepair).toBe(3);
    expect(reopened.service.getSnapshot().photos).toHaveLength(3);
    expect(reopened.service.getSnapshot().photos).toHaveLength(3);
    reopened.db.close();
    // Node has no browser bitmap/canvas: actual pixel preview rendering requires browser QA.
  });
  it("keeps a real HEIC with absent EXIF time explicitly unknown, then supports manual time and arbitrary location", async () => {
    const now = Date.UTC(2026, 10, 19),
      factory = new IDBFactory();
    const db = await openDatabase(factory, now);
    const service = new TravelFrogService({
      gateway: new IdbUnitOfWork(db),
      clock: { now: () => now, localOffsetMinutes: () => 0 },
      ids: new CryptoIdGenerator(),
      exif: new BrowserExifReader(),
      fingerprints: new BrowserFingerprintReader(),
      cityResolver: new GazetteerCityResolver(),
      logger: new RingBufferLogger(),
      thumbnails: { create: async () => null },
    });
    await service.load();
    const input = new File(
      [
        new Uint8Array(
          readFileSync(
            new URL("./fixtures/synthetic-no-time.heic", import.meta.url),
          ),
        ),
      ],
      "synthetic-no-time.heic",
      { type: "image/heic", lastModified: now },
    );
    const imported = await service.importFiles([input]);
    expect(imported.needsRepair).toBe(1);
    expect(imported.ready).toBe(0);
    expect(service.getSnapshot().batches[0]?.status).toBe("needs-attention");
    const photo = service.getSnapshot().photos[0]!;
    expect(photo.capturedAtSource).toBe("missing");
    expect(photo.sourceRef).toBeTruthy();
    expect(service.getSnapshot().candidates).toHaveLength(0);
    await service.setPhotoCaptureTime(photo.id, Date.UTC(2021, 7, 1, 10));
    await service.setPhotoLocations([photo.id], {
      name: "测试自选坐标",
      country: "法国",
      lat: 48.858,
      lng: 2.295,
    });
    expect(service.getSnapshot().photos[0]).toMatchObject({
      capturedAtSource: "manual",
      capturedAt: Date.UTC(2021, 7, 1, 10),
      geo: { lat: 48.858, lng: 2.295 },
    });
    expect(service.getSnapshot().candidates[0]?.cityRefs[0]?.name).toBe(
      "测试自选坐标",
    );
    db.close();
  });
});
