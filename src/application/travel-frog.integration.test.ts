import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { openDatabase } from "../infrastructure/persistence/idb/database";
import { IdbUnitOfWork } from "../infrastructure/persistence/idb/unit-of-work";
import type { CityRef } from "../domain/city/city-ref";
import { makeCityRef } from "../domain/city/city-ref";
import type {
  Clock,
  CityResolver,
  ExifReader,
  FingerprintReader,
  IdGenerator,
  Logger,
  ThumbnailGenerator,
} from "../domain/ports";
import { makeGeoPoint, type GeoPoint } from "../domain/geo/geo-point";
import { TravelFrogService } from "./travel-frog-service";

const NOW = Date.UTC(2026, 1, 1, 10, 0);
const at = (y: number, m: number, d: number, h = 10) =>
  Date.UTC(y, m - 1, d, h);
const KYOTO = { lat: 35.0116, lng: 135.7681 };

function kyotoRef(): CityRef {
  const centroid = makeGeoPoint({
    lat: KYOTO.lat,
    lng: KYOTO.lng,
    source: "candidate",
    approximate: true,
  });
  if (!centroid.ok) throw new Error(centroid.error.message);
  return makeCityRef({
    name: "京都",
    countryCode: "JPN",
    countryName: "日本",
    centroid: centroid.value,
    source: "gazetteer",
    confidence: "high",
  });
}

class TestClock implements Clock {
  now(): number {
    return NOW;
  }
  localOffsetMinutes(): number {
    return 540;
  }
}

class TestIds implements IdGenerator {
  private sequence = 0;
  private next(prefix: string): string {
    this.sequence += 1;
    return `${prefix}_${this.sequence}`;
  }
  newPhotoId(): string {
    return this.next("photo");
  }
  newTripId(): string {
    return this.next("trip");
  }
  newVisitId(): string {
    return this.next("visit");
  }
  newCandidateId(): string {
    return this.next("cand");
  }
  newMemoryId(): string {
    return this.next("memory");
  }
  newWishId(): string {
    return this.next("wish");
  }
  newManualVisitId(): string {
    return this.next("manual");
  }
  newImportBatchId(): string {
    return this.next("batch");
  }
  newImportIssueId(): string {
    return this.next("issue");
  }
  newAuditId(): string {
    return this.next("audit");
  }
}

interface ExifSeed {
  capturedAt: number;
  geo: { lat: number; lng: number } | null;
}

const SEEDS: Record<string, ExifSeed> = {
  "a.jpg": { capturedAt: at(2025, 5, 2, 10), geo: KYOTO },
  "b.jpg": { capturedAt: at(2025, 5, 2, 19), geo: KYOTO },
  "c.jpg": { capturedAt: at(2025, 8, 3, 11), geo: KYOTO },
  "x.jpg": { capturedAt: at(2025, 5, 2, 12), geo: null },
};

const exif: ExifReader = {
  async read(file) {
    const seed = SEEDS[file.name] ?? {
      capturedAt: at(2025, 5, 2, 10),
      geo: KYOTO,
    };
    return {
      capturedAt: seed.capturedAt,
      capturedAtSource: "exif-original",
      offsetMinutes: 540,
      geo: seed.geo,
      orientation: 1,
      mimeType: "image/jpeg",
      error: null,
    };
  },
};

const thumbnails: ThumbnailGenerator = {
  async create() {
    return null;
  },
};

const fingerprints: FingerprintReader = {
  async hash(file) {
    return { hash: `hash:${file.name}:${file.size}`, weak: false };
  },
};

const cityResolver: CityResolver = {
  resolve(geo: GeoPoint) {
    return geo.lat > 30 ? kyotoRef() : null;
  },
  resolveByName(name) {
    return name.includes("京都") ? kyotoRef() : null;
  },
  suggest() {
    return [];
  },
};

const logger: Logger = {
  debug() {},
  warn() {},
  error() {},
  recent() {
    return [];
  },
};

function file(name: string): File {
  return new File([`${name}-bytes`], name, {
    type: "image/jpeg",
    lastModified: NOW,
  });
}

async function createService(
  clock: Clock = new TestClock(),
  factory = new IDBFactory(),
) {
  const db = await openDatabase(factory, NOW);
  const service = new TravelFrogService({
    gateway: new IdbUnitOfWork(db),
    clock,
    ids: new TestIds(),
    exif,
    thumbnails,
    fingerprints,
    cityResolver,
    logger,
  });
  await service.load();
  return { service, db };
}

describe("travel-frog application flow", () => {
  let service: TravelFrogService;

  beforeEach(async () => {
    const created = await createService();
    service = created.service;
  });

  it("imports, splits, confirms, fills locations and deletes a trip", async () => {
    const summary = await service.importFiles([
      file("a.jpg"),
      file("b.jpg"),
      file("c.jpg"),
    ]);
    expect(summary.imported).toBe(3);
    expect(summary.candidateCount).toBe(2);

    const pending = service
      .getSnapshot()
      .candidates.filter((candidate) => candidate.status === "pending");
    expect(pending).toHaveLength(2);
    expect(
      service.getSnapshot().photos.every((photo) => photo.candidateId !== null),
    ).toBe(true);

    const firstTripId = await service.confirmCandidate(pending[0]?.id ?? "");
    const trips = service.getSnapshot().trips;
    expect(trips.some((trip) => trip.id === firstTripId)).toBe(true);
    expect(service.getSnapshot().visits.length).toBeGreaterThan(0);

    await service.saveMemory(firstTripId, "在鸭川边坐了很久。");
    expect(service.getSnapshot().memories[0]?.text).toBe("在鸭川边坐了很久。");

    const located = service
      .getSnapshot()
      .photos.filter((photo) => photo.geo !== null);
    expect(located.length).toBeGreaterThan(0);

    const unlocatedSummary = await service.importFiles([file("x.jpg")]);
    expect(unlocatedSummary.imported).toBe(1);
    const unlocated = service
      .getSnapshot()
      .photos.find((photo) => photo.fileName === "x.jpg");
    expect(unlocated?.geo).toBeNull();

    const suggestions = service.suggestions();
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]?.reason).toBe("same-day-gps");
    const applied = await service.applyLocationSuggestions([
      suggestions[0]?.photoId ?? "",
    ]);
    expect(applied).toBe(1);
    const filled = service
      .getSnapshot()
      .photos.find((photo) => photo.id === suggestions[0]?.photoId);
    expect(filled?.geo).not.toBeNull();

    const photoIdsOfTrip = service
      .getSnapshot()
      .photos.filter((photo) => photo.tripId === firstTripId)
      .map((photo) => photo.id);
    await service.deleteTrip(firstTripId);
    const snapshot = service.getSnapshot();
    expect(snapshot.trips.some((trip) => trip.id === firstTripId)).toBe(false);
    expect(snapshot.memories).toHaveLength(0);
    expect(
      snapshot.photos
        .filter((photo) => photoIdsOfTrip.includes(photo.id))
        .every((photo) => photo.tripId === null),
    ).toBe(true);
  });

  it("reports duplicates instead of importing the same bytes twice", async () => {
    await service.importFiles([file("a.jpg")]);
    const second = await service.importFiles([file("a.jpg")]);
    expect(second.imported).toBe(0);
    expect(second.duplicates).toBe(1);
    expect(service.getSnapshot().photos).toHaveLength(1);
  });

  it("persists settings and redacts coordinates on export by default", async () => {
    await service.importFiles([file("a.jpg")]);
    await service.saveSettings({ theme: "dark", cloudSync: true });
    expect(service.getSnapshot().settings.theme).toBe("dark");
    expect(service.getSnapshot().settings.cloudSync).toBe(true);

    const redacted = await service.exportArchive(false);
    expect(redacted.includeCoordinates).toBe(false);
    expect(
      redacted.photos.every(
        (photo) => (photo as { geo: unknown }).geo === null,
      ),
    ).toBe(true);

    const full = await service.exportArchive(true);
    expect(full.includeCoordinates).toBe(true);
    expect(full.trips).toHaveLength(0);
    expect(full.photos.length).toBe(1);
  });

  it("keeps demo data isolated and removable", async () => {
    await service.importFiles([file("a.jpg")]);
    await service.loadDemo();
    const withDemo = service.getSnapshot();
    expect(withDemo.trips.some((trip) => trip.origin === "demo")).toBe(true);

    await service.removeDemo();
    const cleaned = service.getSnapshot();
    expect(cleaned.trips.some((trip) => trip.origin === "demo")).toBe(false);
    expect(cleaned.photos.some((photo) => photo.origin === "demo")).toBe(false);
    expect(
      cleaned.photos.filter((photo) => photo.origin === "user"),
    ).toHaveLength(1);
  });

  it("clears every local record on explicit delete-all", async () => {
    await service.importFiles([file("a.jpg")]);
    await service.loadDemo();
    await service.deleteAll();
    const empty = service.getSnapshot();
    expect(empty.trips).toHaveLength(0);
    expect(empty.photos).toHaveLength(0);
    expect(empty.candidates).toHaveLength(0);
    expect(empty.memories).toHaveLength(0);
    expect(empty.wishes).toHaveLength(0);
  });
});

describe("storyboard postcard choices", () => {
  it("keeps a delivered postcard undecided when photos are confirmed, and fulfils only after keeping it", async () => {
    const { service, db } = await createService();
    const id = await service.addWish({ name: "京都", region: "日本" });
    await service.deliverWish(id, { note: "替你看了鸭川。" });
    await service.importFiles([file("a.jpg")]);
    await service.confirmCandidate(
      service.getSnapshot().candidates.find((c) => c.status === "pending")!.id,
    );
    expect(service.getSnapshot().wishes.find((w) => w.id === id)?.status).toBe(
      "received",
    );
    await service.setWishStatus(id, "stamped");
    await service.importFiles([file("c.jpg")]);
    await service.confirmCandidate(
      service.getSnapshot().candidates.find((c) => c.status === "pending")!.id,
    );
    expect(service.getSnapshot().wishes.find((w) => w.id === id)?.status).toBe(
      "fulfilled",
    );
    db.close();
  });

  it("preserves a decline across reload and never fulfils it from a later trip", async () => {
    const factory = new IDBFactory();
    const { service, db } = await createService(new TestClock(), factory);
    const id = await service.addWish({ name: "京都", region: "日本" });
    await service.deliverWish(id, { note: "留给下次。" });
    await service.setWishStatus(id, "declined");
    await service.importFiles([file("a.jpg")]);
    await service.confirmCandidate(service.getSnapshot().candidates[0]!.id);
    db.close();
    const reloaded = await createService(new TestClock(), factory);
    expect(
      reloaded.service.getSnapshot().wishes.find((w) => w.id === id)?.status,
    ).toBe("declined");
    await expect(
      reloaded.service.setWishStatus(id, "stamped"),
    ).rejects.toThrow();
    reloaded.db.close();
  });

  it("recovers pending deliveries from persisted creation time after reload, exactly once", async () => {
    let now = NOW;
    const clock: Clock = { now: () => now, localOffsetMinutes: () => 540 };
    const factory = new IDBFactory();
    const { service, db } = await createService(clock, factory);
    const id = await service.addWish({ name: "京都", region: "日本" });
    await service.deliverDuePostcards();
    expect(service.getSnapshot().wishes.find((w) => w.id === id)?.status).toBe(
      "pending",
    );
    db.close();
    now += 6001;
    const reloaded = await createService(clock, factory);
    await reloaded.service.deliverDuePostcards();
    const received = reloaded.service
      .getSnapshot()
      .wishes.find((w) => w.id === id);
    expect(received?.status).toBe("received");
    expect(received?.note).toContain("京都");
    await reloaded.service.deliverDuePostcards();
    expect(
      reloaded.service.getSnapshot().wishes.find((w) => w.id === id),
    ).toEqual(received);
    reloaded.db.close();
  });

  it("rejects a repository write that skips the postcard choice", async () => {
    const { service, db } = await createService();
    const id = await service.addWish({ name: "京都", region: "日本" });
    await service.deliverWish(id, { note: "抵达京都。" });
    const wish = service.getSnapshot().wishes.find((w) => w.id === id)!;
    const gateway = new IdbUnitOfWork(db);
    await expect(
      gateway.run((repos) =>
        repos.wishes.save({ ...wish, status: "fulfilled" }),
      ),
    ).rejects.toThrow();
    expect(
      (await gateway.read((repos) => repos.wishes.get(wish.id)))?.status,
    ).toBe("received");
    db.close();
  });
});

it("reloading the demo preserves a user choice already made on its postcard", async () => {
  const { service, db } = await createService();
  await service.loadDemo();
  const received = service
    .getSnapshot()
    .wishes.find((wish) => wish.status === "received")!;
  await service.setWishStatus(received.id, "declined");
  await service.loadDemo();
  expect(
    service.getSnapshot().wishes.find((wish) => wish.id === received.id)
      ?.status,
  ).toBe("declined");
  db.close();
});

describe('autonomous travel persistence and direction', () => {
  const hoian = {
    name: '会安',
    country: '越南',
    countryCode: 'VNM',
    lat: 15.8801,
    lng: 108.338,
  };
  it('travels without imported photos, delivers once, and creates no real trips or awards', async () => {
    let now = NOW;
    const clock: Clock = { now: () => now, localOffsetMinutes: () => 0 };
    const { service, db } = await createService(clock);
    await service.configureFrogTravel({ pace: 'preview' });
    const j = service.getSnapshot().frogTravel!.current!;
    expect(j.source).toBe('autonomous');
    now = j.letterAt! - 1;
    await service.advanceFrogTravel();
    expect(service.getSnapshot().wishes).toHaveLength(0);
    now = j.letterAt!;
    await service.advanceFrogTravel();
    await service.advanceFrogTravel();
    expect(service.getSnapshot().wishes).toHaveLength(1);
    expect(service.getSnapshot().wishes[0]).toMatchObject({
      status: 'received',
      delivery: 'journey',
      source: 'frog',
    });
    expect(service.getSnapshot().wishes[0]?.note).toContain('模拟旅记');
    expect(service.getSnapshot().trips).toHaveLength(0);
    expect(service.getSnapshot().home.specialties).toHaveLength(0);
    db.close();
  });
  it('recovers one planned journey after months offline without inventing a backlog', async () => {
    let now = NOW;
    const clock: Clock = { now: () => now, localOffsetMinutes: () => 0 };
    const factory = new IDBFactory();
    const first = await createService(clock, factory);
    const j = first.service.getSnapshot().frogTravel!.current!;
    first.db.close();
    now = j.homeAt + 60 * 86400_000;
    const second = await createService(clock, factory);
    expect(second.service.getSnapshot().frogTravel?.history).toHaveLength(1);
    expect(
      second.service.getSnapshot().frogTravel?.current?.prepareAt,
    ).toBeGreaterThan(now);
    const count = second.service.getSnapshot().wishes.length;
    await second.service.advanceFrogTravel();
    expect(second.service.getSnapshot().wishes).toHaveLength(count);
    second.db.close();
  });
  it('queues a direction while away and excludes its card from legacy six-second delivery', async () => {
    let now = NOW;
    const clock: Clock = { now: () => now, localOffsetMinutes: () => 0 };
    const { service, db } = await createService(clock);
    await service.configureFrogTravel({ pace: 'preview' });
    const j = service.getSnapshot().frogTravel!.current!;
    now = j.departAt + 1;
    await service.advanceFrogTravel();
    const id = await service.directFrogTravel(hoian);
    expect(service.getSnapshot().frogTravel?.current?.id).toBe(j.id);
    expect(service.getSnapshot().frogTravel?.direction?.destination.name).toBe(
      '会安',
    );
    now += 6001;
    await service.deliverDuePostcards();
    expect(service.getSnapshot().wishes.find((w) => w.id === id)?.status).toBe(
      'pending',
    );
    now = j.homeAt + 1;
    await service.advanceFrogTravel();
    expect(service.getSnapshot().frogTravel?.current).toMatchObject({
      source: 'directed',
      wishId: id,
      destination: { name: '会安' },
    });
    db.close();
  });
  it('finishes an active journey when automatic departure is switched off and then stays home', async () => {
    let now = NOW;
    const clock: Clock = { now: () => now, localOffsetMinutes: () => 0 };
    const { service, db } = await createService(clock);
    const j = service.getSnapshot().frogTravel!.current!;
    now = j.departAt + 1;
    await service.configureFrogTravel({ enabled: false });
    expect(service.getSnapshot().frogTravel?.current?.id).toBe(j.id);
    now = j.homeAt + 1;
    await service.advanceFrogTravel();
    expect(service.getSnapshot().frogTravel).toMatchObject({
      enabled: false,
      current: null,
    });
    now += 86400_000;
    await service.advanceFrogTravel();
    expect(service.getSnapshot().frogTravel?.history).toHaveLength(1);
    db.close();
  });
  it('guards the transaction so two open tabs cannot duplicate a letter or itinerary', async () => {
    let now = NOW;
    const clock: Clock = { now: () => now, localOffsetMinutes: () => 0 };
    const factory = new IDBFactory();
    const first = await createService(clock, factory);
    await first.service.configureFrogTravel({ pace: 'preview' });
    const second = await createService(clock, factory);
    const j = first.service.getSnapshot().frogTravel!.current!;
    now = j.letterAt!;
    await Promise.all([
      first.service.advanceFrogTravel(),
      second.service.advanceFrogTravel(),
    ]);
    const stored = await new IdbUnitOfWork(first.db).read(async (repos) => ({
      letters: await repos.wishes.list(),
      travel: await repos.frogTravel.get(),
    }));
    expect(stored.letters.filter((w) => w.id === j.wishId)).toHaveLength(1);
    expect(stored.travel?.current?.id).toBe(j.id);
    first.db.close();
    second.db.close();
  });
  it('keeps a directed journey on its actual itinerary instead of a fixed six-second promise', async () => {
    let now = NOW;
    const clock: Clock = { now: () => now, localOffsetMinutes: () => 0 };
    const { service, db } = await createService(clock);
    const id = await service.directFrogTravel(hoian);
    const journey = service.getSnapshot().frogTravel!.current!;
    expect(journey.source).toBe('directed');
    expect(journey.pace).toBe('natural');
    now += 6001;
    await service.deliverDuePostcards();
    await service.advanceFrogTravel();
    expect(service.getSnapshot().wishes.find((w) => w.id === id)?.status).toBe(
      'pending',
    );
    now = journey.letterAt!;
    await service.advanceFrogTravel();
    expect(service.getSnapshot().wishes.find((w) => w.id === id)?.status).toBe(
      'received',
    );
    expect(service.getSnapshot().frogTravel?.current?.id).toBe(journey.id);
    db.close();
  });
  it('withdraws only a pending direction and resumes choosing independently', async () => {
    const { service, db } = await createService();
    const id = await service.directFrogTravel(hoian);
    await service.cancelFrogDirection();
    expect(service.getSnapshot().wishes.some((w) => w.id === id)).toBe(false);
    expect(service.getSnapshot().frogTravel?.current?.source).toBe(
      'autonomous',
    );
    expect(service.getSnapshot().frogTravel?.direction).toBeNull();
    db.close();
  });
  it('replans an unstarted journey from the new home while preserving the saved direction', async () => {
    const { service, db } = await createService();
    const id = await service.directFrogTravel(hoian);
    await service.moveHome('京都');
    expect(service.getSnapshot().frogTravel?.current).toMatchObject({
      source: 'directed',
      wishId: id,
      from: { name: '京都' },
      destination: { name: '会安' },
    });
    db.close();
  });
  it('allows one explicit direction while automatic travel is off without silently re-enabling it', async () => {
    let now = NOW;
    const clock: Clock = { now: () => now, localOffsetMinutes: () => 0 };
    const { service, db } = await createService(clock);
    await service.configureFrogTravel({ enabled: false });
    const id = await service.directFrogTravel(hoian);
    const j = service.getSnapshot().frogTravel!.current!;
    expect(j.wishId).toBe(id);
    expect(service.getSnapshot().frogTravel?.enabled).toBe(false);
    now = j.homeAt + 1;
    await service.advanceFrogTravel();
    expect(service.getSnapshot().frogTravel).toMatchObject({
      enabled: false,
      current: null,
    });
    db.close();
  });
});
