import { StorageError, toStorageError } from '../errors';
import { runMigrations } from './migrations';
import { DB_NAME, DB_VERSION, STORES } from './schema';

export interface WriteBuffer {
  readonly puts: Map<string, Map<string, unknown>>;
  readonly deletes: Map<string, Set<string>>;
  readonly touched: Set<string>;
}

export function createWriteBuffer(): WriteBuffer {
  return { puts: new Map(), deletes: new Map(), touched: new Set() };
}

export class IdbDatabase {
  private readonly db: IDBDatabase;

  private constructor(db: IDBDatabase) {
    this.db = db;
  }

  static async open(factory: IDBFactory, now: number): Promise<IdbDatabase> {
    return new Promise((resolve, reject) => {
      let request: IDBOpenDBRequest;
      try {
        request = factory.open(DB_NAME, DB_VERSION);
      } catch (error) {
        reject(new StorageError('NOT_SUPPORTED', '当前环境不支持 IndexedDB', error));
        return;
      }
      request.onupgradeneeded = (event) => {
        try {
          runMigrations({
            db: request.result,
            tx: request.transaction as IDBTransaction,
            oldVersion: event.oldVersion,
            now,
          });
        } catch (error) {
          request.transaction?.abort();
          reject(new StorageError('MIGRATION_FAILED', '本地数据结构升级失败，旧数据已保留', error));
        }
      };
      request.onsuccess = () => resolve(new IdbDatabase(request.result));
      request.onerror = () => reject(new StorageError('DB_OPEN_FAILED', '无法打开本地数据库', request.error));
      request.onblocked = () => reject(new StorageError('DB_OPEN_FAILED', '本地数据库被其他页面占用，请关闭其他标签页'));
    });
  }

  close(): void {
    this.db.close();
  }

  private async read<T>(storeName: string, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      let tx: IDBTransaction;
      try {
        tx = this.db.transaction(storeName, 'readonly');
      } catch (error) {
        reject(toStorageError(error));
        return;
      }
      const request = fn(tx.objectStore(storeName));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(toStorageError(request.error));
    });
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    return this.read<T[]>(storeName, (store) => store.getAll() as IDBRequest<T[]>);
  }

  async get<T>(storeName: string, key: IDBValidKey): Promise<T | null> {
    const value = await this.read<T | undefined>(storeName, (store) => store.get(key) as IDBRequest<T | undefined>);
    return value ?? null;
  }

  async getAllByIndex<T>(storeName: string, index: string, key: IDBValidKey): Promise<T[]> {
    return new Promise((resolve, reject) => {
      let tx: IDBTransaction;
      try {
        tx = this.db.transaction(storeName, 'readonly');
      } catch (error) {
        reject(toStorageError(error));
        return;
      }
      const request = tx.objectStore(storeName).index(index).getAll(key);
      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(toStorageError(request.error));
    });
  }

  async getMeta<T>(key: string): Promise<T | null> {
    return this.get<T>(STORES.meta, key);
  }

  async revision(): Promise<number> {
    const record = await this.get<{ value?: number }>(STORES.meta, 'revision');
    return record?.value ?? 0;
  }

  /** Applies every buffered write in one transaction; any failure rolls the whole batch back. */
  async commit(buffer: WriteBuffer): Promise<void> {
    if (buffer.touched.size === 0) return;
    const stores = Array.from(new Set([...buffer.touched, STORES.meta]));
    return new Promise((resolve, reject) => {
      let tx: IDBTransaction;
      try {
        tx = this.db.transaction(stores, 'readwrite');
      } catch (error) {
        reject(toStorageError(error));
        return;
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(toStorageError(tx.error));
      tx.onabort = () => reject(toStorageError(tx.error ?? new StorageError('STORAGE_FAILED', '写入被中止')));
      try {
        for (const storeName of stores) {
          const deletions = buffer.deletes.get(storeName);
          if (deletions) {
            const store = tx.objectStore(storeName);
            for (const key of deletions) store.delete(key);
          }
          const puts = buffer.puts.get(storeName);
          if (puts) {
            const store = tx.objectStore(storeName);
            for (const value of puts.values()) store.put(value);
          }
        }
        const meta = tx.objectStore(STORES.meta);
        const revisionRequest = meta.get('revision');
        revisionRequest.onsuccess = () => {
          const current = (revisionRequest.result as { value?: number } | undefined)?.value ?? 0;
          meta.put({ key: 'revision', value: current + 1 });
        };
      } catch (error) {
        try {
          tx.abort();
        } catch {
          // already aborted
        }
        reject(toStorageError(error));
      }
    });
  }

  /** Removes every travel-frog record, including the legacy store when present. */
  async clearAll(): Promise<void> {
    const names = Array.from(this.db.objectStoreNames).filter((name) => name !== STORES.meta);
    const stores = Array.from(new Set([...names, STORES.meta]));
    const tx = this.db.transaction(stores, 'readwrite');
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(toStorageError(tx.error));
      tx.onabort = () => reject(toStorageError(tx.error));
      for (const name of names) tx.objectStore(name).clear();
      tx.objectStore(STORES.meta).put({ key: 'schema', schemaVersion: DB_VERSION, revision: 0 });
      tx.objectStore(STORES.meta).put({ key: 'revision', value: 0 });
    });
  }
}

export async function openDatabase(factory: IDBFactory, now: number): Promise<IdbDatabase> {
  return IdbDatabase.open(factory, now);
}

export function deleteDatabase(factory: IDBFactory): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = factory.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(toStorageError(request.error));
    request.onblocked = () => reject(new StorageError('STORAGE_FAILED', '数据库被其他页面占用'));
  });
}
