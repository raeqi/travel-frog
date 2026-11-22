/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { openDatabase } from "../infrastructure/persistence/idb/database";
import { IdbUnitOfWork } from "../infrastructure/persistence/idb/unit-of-work";
import { BrowserExifReader } from "../infrastructure/exif/exif-reader.browser";
import { BrowserFingerprintReader } from "../infrastructure/media/fingerprint.browser";
import { GazetteerCityResolver } from "../infrastructure/geo/city-resolver";
import { CryptoIdGenerator } from "../infrastructure/crypto-id-generator";
import { RingBufferLogger } from "../infrastructure/logging/ring-buffer-logger";
import { TravelFrogService } from "./travel-frog-service";
import type { ThumbnailGenerator } from "../domain/ports";
import type { ImportProgress } from "./import-photos";

const NOW = Date.UTC(2026, 10, 20);
const clock = { now: () => NOW, localOffsetMinutes: () => 0 };

function photoFile(name: string): File {
  return new File(
    [new Uint8Array(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)))],
    name,
    { type: "image/jpeg", lastModified: NOW },
  );
}

async function createService(thumbnails: ThumbnailGenerator) {
  const db = await openDatabase(new IDBFactory(), NOW);
  const service = new TravelFrogService({
    gateway: new IdbUnitOfWork(db),
    clock,
    ids: new CryptoIdGenerator(),
    exif: new BrowserExifReader(),
    thumbnails,
    fingerprints: new BrowserFingerprintReader(),
    cityResolver: new GazetteerCityResolver(),
    logger: new RingBufferLogger(),
  });
  await service.load();
  return { service, db };
}

const tinyThumbnail: ThumbnailGenerator = {
  async create() {
    return new Blob(["thumb"], { type: "image/webp" });
  },
};

describe("import pipeline concurrency", () => {
  it("keeps two files in flight and preserves duplicate detection", async () => {
    let active = 0;
    let maxActive = 0;
    const thumbnails: ThumbnailGenerator = {
      async create() {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 15));
        active -= 1;
        return new Blob(["thumb"], { type: "image/webp" });
      },
    };
    const { service, db } = await createService(thumbnails);
    const files = [
      photoFile("paris-1.jpg"),
      photoFile("paris-2.jpg"),
      photoFile("paris-3.jpg"),
      photoFile("paris-1.jpg"),
    ];
    const done: number[] = [];
    const summary = await service.importFiles(files, (progress: ImportProgress) => {
      done.push(progress.done);
    });
    expect(maxActive).toBe(2);
    expect(summary.imported).toBe(3);
    expect(summary.duplicates).toBe(1);
    expect(summary.failed).toBe(0);
    expect(summary.withLocation).toBe(3);
    expect(summary.withoutLocation).toBe(0);
    expect(service.getSnapshot().photos).toHaveLength(3);
    expect(done[done.length - 1]).toBe(4);
    expect(done).toEqual([...done].sort((a, b) => a - b));
    db.close();
  });
});

describe("import cancellation", () => {
  it("cancels before commit and leaves the archive untouched", async () => {
    let release: () => void = () => {};
    const started = new Promise<void>((resolve) => {
      release = resolve;
    });
    const thumbnails: ThumbnailGenerator = {
      async create() {
        await started;
        return new Blob(["thumb"], { type: "image/webp" });
      },
    };
    const { service, db } = await createService(thumbnails);
    const controller = new AbortController();
    const importing = service.importFiles(
      [photoFile("paris-1.jpg"), photoFile("paris-2.jpg")],
      undefined,
      controller.signal,
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    controller.abort();
    release();
    await expect(importing).rejects.toMatchObject({ code: "IMPORT_CANCELLED" });
    expect(service.getSnapshot().photos).toHaveLength(0);
    expect(service.getSnapshot().candidates).toHaveLength(0);
    expect(service.getSnapshot().batches).toHaveLength(0);
    db.close();
  });

  it("still imports normally with the default thumbnail generator", async () => {
    const { service, db } = await createService(tinyThumbnail);
    const summary = await service.importFiles([
      photoFile("paris-1.jpg"),
      photoFile("paris-2.jpg"),
    ]);
    expect(summary.imported).toBe(2);
    expect(service.getSnapshot().photos).toHaveLength(2);
    db.close();
  });
});
