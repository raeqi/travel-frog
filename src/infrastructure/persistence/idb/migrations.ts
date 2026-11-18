import { migrateLegacyArchive } from './legacy';
import { DB_VERSION, SCHEMA_V2, STORES, type StoreSpec } from './schema';

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
    meta.put({ key: 'schema', schemaVersion: DB_VERSION, revision: 0, lastOpenedAt: now });
    meta.put({ key: 'revision', value: 0, updatedAt: now });
    tx.objectStore(STORES.migrations).put({ version: DB_VERSION, name: 'entity-stores', appliedAt: now });
  },
};

export const MIGRATIONS: readonly Migration[] = [migrationV2];

/** Runs every migration whose target version is newer than the database. */
export function runMigrations(context: MigrationContext): void {
  for (const migration of MIGRATIONS.slice().sort((a, b) => a.version - b.version)) {
    if (migration.version <= context.oldVersion) continue;
    migration.up(context);
  }
}
