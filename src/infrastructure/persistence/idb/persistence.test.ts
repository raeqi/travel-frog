import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { createTrip } from '../../../domain/trip/trip';
import { makeTimeRange } from '../../../domain/common/time';
import { DB_NAME } from './schema';
import { openDatabase } from './database';
import { IdbUnitOfWork } from './unit-of-work';

const NOW = Date.UTC(2026, 0, 2, 9, 0);

function createLegacyV1(factory: IDBFactory, data: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const open = factory.open(DB_NAME, 1);
    open.onupgradeneeded = () => {
      open.result.createObjectStore('state');
    };
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('state', 'readwrite');
      tx.objectStore('state').put(data, 'app-data');
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error('legacy transaction aborted'));
    };
  });
}

const LEGACY_ARCHIVE = {
  photos: {
    p1: { id: 'p1', name: 'kyoto.jpg', takenAt: NOW - 86_400_000, lat: 35.0116, lng: 135.7681, locationSource: 'exif' },
  },
  trips: [
    {
      id: 't1',
      title: '京都 2025',
      startAt: NOW - 172_800_000,
      endAt: NOW - 86_400_000,
      memory: '第一次看见雪',
      createdAt: NOW - 172_800_000,
      visits: [{ id: 'v1', name: '清水寺', city: '京都', country: '日本', startAt: NOW - 172_800_000, endAt: NOW - 86_400_000, lat: 34.9949, lng: 135.785 }],
    },
  ],
  candidates: [{ id: 'c1', startAt: NOW, endAt: NOW + 3_600_000, photoIds: ['p1'], status: 'pending' }],
  wishes: [{ id: 'w1', name: '札幌', country: '日本', region: '北海道', status: 'next' }],
  manualVisited: [{ id: 'm1', name: '大阪', country: '日本', year: 2024 }],
  settings: { theme: 'dark' },
};

describe('IndexedDB migration', () => {
  it('converts a v1 single-document archive into entity stores', async () => {
    const factory = new IDBFactory();
    await createLegacyV1(factory, LEGACY_ARCHIVE);

    const db = await openDatabase(factory, NOW);
    const uow = new IdbUnitOfWork(db);
    const data = await uow.read(async (repos) => {
      const [trips, photos, memories, visits, candidates, wishes, manualVisits, batches] = await Promise.all([
        repos.trips.listAll(),
        repos.photos.listAll(),
        repos.memories.listAll(),
        repos.visits.listAll(),
        repos.candidates.listAll(),
        repos.wishes.list(),
        repos.manualVisits.list(),
        repos.batches.listRecent(10),
      ]);
      return { trips, photos, memories, visits, candidates, wishes, manualVisits, batches };
    });

    expect(data.trips).toHaveLength(1);
    expect(data.trips[0]?.title).toBe('京都 2025');
    expect(data.trips[0]?.cityRefs.map((city) => city.name)).toContain('京都');
    expect(data.photos).toHaveLength(1);
    expect(data.photos[0]?.geo?.lat).toBeCloseTo(35.0116);
    expect(data.photos[0]?.capturedAt).toBe(NOW - 86_400_000);
    expect(data.visits).toHaveLength(1);
    expect(data.visits[0]?.displayName).toBe('清水寺');
    expect(data.memories).toHaveLength(1);
    expect(data.memories[0]?.text).toBe('第一次看见雪');
    expect(data.candidates).toHaveLength(1);
    expect(data.candidates[0]?.status).toBe('pending');
    expect(data.wishes[0]?.status).toBe('next');
    expect(data.manualVisits[0]?.year).toBe(2024);
    expect(data.batches.some((batch) => batch.id === 'legacy')).toBe(true);

    db.close();
  });
});

describe('IdbUnitOfWork', () => {
  const trip = () => {
    const range = makeTimeRange(NOW, NOW + 86_400_000);
    if (!range.ok) throw new Error(range.error.message);
    const created = createTrip({
      id: 't1',
      title: '测试旅程',
      timeRange: range.value,
      cityRefs: [],
      coverPhotoId: null,
      sourceCandidateId: null,
      origin: 'user',
      createdAt: NOW,
    });
    if (!created.ok) throw new Error(created.error.message);
    return created.value;
  };

  it('commits every buffered write in one transaction', async () => {
    const factory = new IDBFactory();
    const db = await openDatabase(factory, NOW);
    const uow = new IdbUnitOfWork(db);
    const entity = trip();

    await uow.run(async (repos) => {
      await repos.trips.save(entity);
    });

    const stored = await uow.read(async (repos) => repos.trips.listAll());
    expect(stored.map((item) => item.id)).toEqual(['t1']);

    db.close();
  });

  it('leaves the database untouched when a use case throws after writing', async () => {
    const factory = new IDBFactory();
    const db = await openDatabase(factory, NOW);
    const uow = new IdbUnitOfWork(db);

    await expect(
      uow.run(async (repos) => {
        await repos.trips.save(trip());
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const stored = await uow.read(async (repos) => repos.trips.listAll());
    expect(stored).toHaveLength(0);

    db.close();
  });

  it('surfaces validation failures instead of silently dropping writes', async () => {
    const factory = new IDBFactory();
    const db = await openDatabase(factory, NOW);
    const uow = new IdbUnitOfWork(db);
    const invalid = { ...trip(), title: '' };

    await expect(uow.run(async (repos) => repos.trips.save(invalid))).rejects.toThrow();
    const stored = await uow.read(async (repos) => repos.trips.listAll());
    expect(stored).toHaveLength(0);

    db.close();
  });
});
