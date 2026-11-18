import type { Repositories, UnitOfWork } from '../../../domain/ports';
import { createRepositories } from './repositories';
import { createWriteBuffer, type IdbDatabase } from './database';

/**
 * Buffers repository writes and flushes them in one IndexedDB transaction after the use case
 * succeeds. A thrown error (domain or storage) leaves the database untouched.
 */
export class IdbUnitOfWork implements UnitOfWork {
  private readonly db: IdbDatabase;

  constructor(db: IdbDatabase) {
    this.db = db;
  }

  async run<T>(work: (repos: Repositories) => Promise<T>): Promise<T> {
    const buffer = createWriteBuffer();
    const repos = createRepositories(this.db, buffer);
    const result = await work(repos);
    await this.db.commit(buffer);
    return result;
  }

  /** Read-only pass: no transaction is opened and no revision is bumped. */
  async read<T>(work: (repos: Repositories) => Promise<T>): Promise<T> {
    return work(createRepositories(this.db, createWriteBuffer()));
  }

  async clear(): Promise<void> {
    await this.db.clearAll();
  }
}
