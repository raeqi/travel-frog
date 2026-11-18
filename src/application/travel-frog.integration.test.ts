import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../infrastructure/persistence/idb/database';
import { IdbUnitOfWork } from '../infrastructure/persistence/idb/unit-of-work';
import type { CityRef } from '../domain/city/city-ref';
import { makeCityRef } from '../domain/city/city-ref';
import type { Clock, CityResolver, ExifReader, FingerprintReader, IdGenerator, Logger, ThumbnailGenerator } from '../domain/ports';
import { makeGeoPoint, type GeoPoint } from '../domain/geo/geo-point';
import { TravelFrogService } from './travel-frog-service';

const NOW = Date.UTC(2026, 1, 1, 10, 0);
const at = (y: number, m: number, d: number, h = 10) => Date.UTC(y, m - 1, d, h);
const KYOTO = { lat: 35.0116, lng: 135.7681 };

function kyotoRef(): CityRef {
  const centroid = makeGeoPoint({ lat: KYOTO.lat, lng: KYOTO.lng, source: 'candidate', approximate: true });
  if (!centroid.ok) throw new Error(centroid.error.message);
  return makeCityRef({
    name: '京都',
    countryCode: 'JPN',
    countryName: '日本',
    centroid: centroid.value,
    source: 'gazetteer',
    confidence: 'high',
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
  newPhotoId(): string { return this.next('photo'); }
  newTripId(): string { return this.next('trip'); }
  newVisitId(): string { return this.next('visit'); }
  newCandidateId(): string { return this.next('cand'); }
  newMemoryId(): string { return this.next('memory'); }
  newWishId(): string { return this.next('wish'); }
  newManualVisitId(): string { return this.next('manual'); }
  newImportBatchId(): string { return this.next('batch'); }
  newImportIssueId(): string { return this.next('issue'); }
  newAuditId(): string { return this.next('audit'); }
}

interface ExifSeed {
  capturedAt: number;
  geo: { lat: number; lng: number } | null;
}

const SEEDS: Record<string, ExifSeed> = {
  'a.jpg': { capturedAt: at(2025, 5, 2, 10), geo: KYOTO },
  'b.jpg': { capturedAt: at(2025, 5, 2, 19), geo: KYOTO },
  'c.jpg': { capturedAt: at(2025, 8, 3, 11), geo: KYOTO },
  'x.jpg': { capturedAt: at(2025, 5, 2, 12), geo: null },
};

const exif: ExifReader = {
  async read(file) {
    const seed = SEEDS[file.name] ?? { capturedAt: at(2025, 5, 2, 10), geo: KYOTO };
    return {
      capturedAt: seed.capturedAt,
      capturedAtSource: 'exif-original',
      offsetMinutes: 540,
      geo: seed.geo,
      orientation: 1,
      mimeType: 'image/jpeg',
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
    return name.includes('京都') ? kyotoRef() : null;
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
  return new File([`${name}-bytes`], name, { type: 'image/jpeg', lastModified: NOW });
}

async function createService() {
  const factory = new IDBFactory();
  const db = await openDatabase(factory, NOW);
  const service = new TravelFrogService({
    gateway: new IdbUnitOfWork(db),
    clock: new TestClock(),
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

describe('travel-frog application flow', () => {
  let service: TravelFrogService;

  beforeEach(async () => {
    const created = await createService();
    service = created.service;
  });

  it('imports, splits, confirms, fills locations and deletes a trip', async () => {
    const summary = await service.importFiles([file('a.jpg'), file('b.jpg'), file('c.jpg')]);
    expect(summary.imported).toBe(3);
    expect(summary.candidateCount).toBe(2);

    const pending = service.getSnapshot().candidates.filter((candidate) => candidate.status === 'pending');
    expect(pending).toHaveLength(2);
    expect(service.getSnapshot().photos.every((photo) => photo.candidateId !== null)).toBe(true);

    const firstTripId = await service.confirmCandidate(pending[0]?.id ?? '');
    const trips = service.getSnapshot().trips;
    expect(trips.some((trip) => trip.id === firstTripId)).toBe(true);
    expect(service.getSnapshot().visits.length).toBeGreaterThan(0);

    await service.saveMemory(firstTripId, '在鸭川边坐了很久。');
    expect(service.getSnapshot().memories[0]?.text).toBe('在鸭川边坐了很久。');

    const located = service.getSnapshot().photos.filter((photo) => photo.geo !== null);
    expect(located.length).toBeGreaterThan(0);

    const unlocatedSummary = await service.importFiles([file('x.jpg')]);
    expect(unlocatedSummary.imported).toBe(1);
    const unlocated = service.getSnapshot().photos.find((photo) => photo.fileName === 'x.jpg');
    expect(unlocated?.geo).toBeNull();

    const suggestions = service.suggestions();
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]?.reason).toBe('same-day-gps');
    const applied = await service.applyLocationSuggestions([suggestions[0]?.photoId ?? '']);
    expect(applied).toBe(1);
    const filled = service.getSnapshot().photos.find((photo) => photo.id === suggestions[0]?.photoId);
    expect(filled?.geo).not.toBeNull();

    const photoIdsOfTrip = service.getSnapshot().photos.filter((photo) => photo.tripId === firstTripId).map((photo) => photo.id);
    await service.deleteTrip(firstTripId);
    const snapshot = service.getSnapshot();
    expect(snapshot.trips.some((trip) => trip.id === firstTripId)).toBe(false);
    expect(snapshot.memories).toHaveLength(0);
    expect(snapshot.photos.filter((photo) => photoIdsOfTrip.includes(photo.id)).every((photo) => photo.tripId === null)).toBe(true);
  });

  it('reports duplicates instead of importing the same bytes twice', async () => {
    await service.importFiles([file('a.jpg')]);
    const second = await service.importFiles([file('a.jpg')]);
    expect(second.imported).toBe(0);
    expect(second.duplicates).toBe(1);
    expect(service.getSnapshot().photos).toHaveLength(1);
  });

  it('persists settings and redacts coordinates on export by default', async () => {
    await service.importFiles([file('a.jpg')]);
    await service.saveSettings({ theme: 'dark', cloudSync: true });
    expect(service.getSnapshot().settings.theme).toBe('dark');
    expect(service.getSnapshot().settings.cloudSync).toBe(true);

    const redacted = await service.exportArchive(false);
    expect(redacted.includeCoordinates).toBe(false);
    expect(redacted.photos.every((photo) => (photo as { geo: unknown }).geo === null)).toBe(true);

    const full = await service.exportArchive(true);
    expect(full.includeCoordinates).toBe(true);
    expect(full.trips).toHaveLength(0);
    expect(full.photos.length).toBe(1);
  });

  it('keeps demo data isolated and removable', async () => {
    await service.importFiles([file('a.jpg')]);
    await service.loadDemo();
    const withDemo = service.getSnapshot();
    expect(withDemo.trips.some((trip) => trip.origin === 'demo')).toBe(true);

    await service.removeDemo();
    const cleaned = service.getSnapshot();
    expect(cleaned.trips.some((trip) => trip.origin === 'demo')).toBe(false);
    expect(cleaned.photos.some((photo) => photo.origin === 'demo')).toBe(false);
    expect(cleaned.photos.filter((photo) => photo.origin === 'user')).toHaveLength(1);
  });

  it('clears every local record on explicit delete-all', async () => {
    await service.importFiles([file('a.jpg')]);
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
