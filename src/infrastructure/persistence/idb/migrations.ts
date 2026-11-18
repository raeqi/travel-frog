import { createWish, migrateLegacyWishStatus, type Wish, type WishSource } from '../../../domain/wish/wish';
import { makeCityRef, type CityRef } from '../../../domain/city/city-ref';
import type { DataOrigin } from '../../../domain/photo/photo';
import type { GeoPoint } from '../../../domain/geo/geo-point';
import { migrateLegacyArchive } from './legacy';
import { SCHEMA_V2, SCHEMA_V4, STORES, type StoreSpec } from './schema';

export interface MigrationContext {
  readonly db: IDBDatabase;
  readonly tx: IDBTransaction;
  readonly oldVersion: number;
  readonly now: number;
}

export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly up: (context: MigrationContext) => void;
}

function createStore(db: IDBDatabase, spec: StoreSpec): void {
  const store = db.objectStoreNames.contains(spec.name)
    ? null
    : db.createObjectStore(spec.name, { keyPath: spec.keyPath });
  if (store) {
    for (const index of spec.indexes) {
      store.createIndex(index.name, index.keyPath, index.unique ? { unique: true } : {});
    }
  }
}

const migrationV2: Migration = {
  version: 2,
  name: 'entity-stores',
  up: ({ db, tx, oldVersion, now }) => {
    for (const spec of SCHEMA_V2) createStore(db, spec);
    if (oldVersion === 1) {
      migrateLegacyArchive(tx, now);
    }
    const meta = tx.objectStore(STORES.meta);
    meta.put({ key: 'schema', schemaVersion: 2, revision: 0, lastOpenedAt: now });
    meta.put({ key: 'revision', value: 0, updatedAt: now });
    tx.objectStore(STORES.migrations).put({ version: 2, name: 'entity-stores', appliedAt: now });
  },
};

const DEFAULT_NOTE = '青蛙替你先去看了一眼。';
const DEFAULT_REGION = '青蛙寄回';

type RawWish = Record<string, unknown>;

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function instant(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function rawCityRef(raw: RawWish): CityRef {
  const existing = raw.cityRef as Partial<CityRef> | undefined;
  if (existing && typeof existing.key === 'string' && typeof existing.name === 'string') {
    return existing as CityRef;
  }
  const centroid = raw.centroid as GeoPoint | null | undefined;
  const lat = typeof raw.lat === 'number' ? raw.lat : centroid?.lat;
  const lng = typeof raw.lng === 'number' ? raw.lng : centroid?.lng;
  return makeCityRef({
    name: str(raw.name, '未命名地点') || '未命名地点',
    countryCode: str(raw.countryCode, 'XXX') || 'XXX',
    countryName: str(raw.country, str(raw.countryName, '未知')) || '未知',
    centroid:
      typeof lat === 'number' && typeof lng === 'number'
        ? { lat, lng, accuracyM: null, source: 'manual', approximate: true }
        : null,
    source: 'derived',
    confidence: 'low',
  });
}

/**
 * Converts a row written before v3 into the five-state postcard model.
 * Idempotent: rows that already use the new shape pass through unchanged.
 */
export function migrateWishRow(raw: RawWish, now: number): Wish | null {
  const id = str(raw.id);
  if (!id) return null;
  const status = migrateLegacyWishStatus(raw.status);
  if (!status.ok) return null;
  const cityRef = rawCityRef(raw);
  const origin: DataOrigin = raw.origin === 'demo' ? 'demo' : 'user';
  const legacySource = raw.source;
  const source: WishSource = legacySource === 'frog' || legacySource === 'user' ? legacySource : origin === 'demo' ? 'frog' : 'user';
  const created = instant(raw.createdAt, now);
  const updated = instant(raw.updatedAt, created);
  const seeded = createWish({
    id,
    cityRef,
    region: str(raw.region) || str(raw.country) || DEFAULT_REGION,
    note: str(raw.note) || str(raw.notes) || DEFAULT_NOTE,
    source,
    from: str(raw.from) || null,
    origin,
    now: created,
    status: status.value,
  });
  if (!seeded.ok) return null;
  return { ...seeded.value, updatedAt: updated };
}

const migrationV3: Migration = {
  version: 3,
  name: 'wish-five-states',
  up: ({ tx, now }) => {
    const store = tx.objectStore(STORES.wishes);
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      const migrated = migrateWishRow(cursor.value as RawWish, now);
      if (migrated) {
        cursor.update(migrated);
      } else {
        cursor.delete();
      }
      cursor.continue();
    };
    const meta = tx.objectStore(STORES.meta);
    meta.put({ key: 'schema', schemaVersion: 3, revision: 0, lastOpenedAt: now });
    tx.objectStore(STORES.migrations).put({ version: 3, name: 'wish-five-states', appliedAt: now });
  },
};

const migrationV4: Migration = {
  version: 4,
  name: 'home-and-map-view',
  up: ({ db, tx, now }) => {
    for (const spec of SCHEMA_V4) createStore(db, spec);
    const meta = tx.objectStore(STORES.meta);
    meta.put({ key: 'schema', schemaVersion: 4, revision: 0, lastOpenedAt: now });
    tx.objectStore(STORES.migrations).put({ version: 4, name: 'home-and-map-view', appliedAt: now });
  },
};

const migrationV5: Migration = {
  version: 5,
  name: 'postcard-states-five',
  up: ({ tx, now }) => {
    const store = tx.objectStore(STORES.wishes);
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      const migrated = migrateWishRow(cursor.value as RawWish, now);
      if (migrated) {
        cursor.update(migrated);
      } else {
        cursor.delete();
      }
      cursor.continue();
    };
    const meta = tx.objectStore(STORES.meta);
    meta.put({ key: 'schema', schemaVersion: 5, revision: 0, lastOpenedAt: now });
    tx.objectStore(STORES.migrations).put({ version: 5, name: 'postcard-states-five', appliedAt: now });
  },
};

export const MIGRATIONS: readonly Migration[] = [migrationV2, migrationV3, migrationV4, migrationV5];

/** Runs every migration whose target version is newer than the database. */
export function runMigrations(context: MigrationContext): void {
  for (const migration of MIGRATIONS.slice().sort((a, b) => a.version - b.version)) {
    if (migration.version <= context.oldVersion) continue;
    migration.up(context);
  }
}
