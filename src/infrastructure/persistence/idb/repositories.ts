import type {
  AuditEntry,
  AuditRepository,
  CandidateRepository,
  HomeRepository,
  MapViewRepository,
  ImportBatchRepository,
  ImportIssueRepository,
  ManualVisitRepository,
  MemoryRepository,
  PhotoRepository,
  Repositories,
  SettingsRepository,
  ThumbnailStore,
  TripRepository,
  VisitRepository,
  WishRepository,
} from '../../../domain/ports';
import type { CandidateId, PhotoId, TripId, VisitId, WishId } from '../../../domain/common/ids';
import { DomainViolation, type DomainError, type Result } from '../../../domain/common/result';
import { validatePhoto, type Photo } from '../../../domain/photo/photo';
import { validateTrip, type Trip } from '../../../domain/trip/trip';
import { validateVisit, type Visit } from '../../../domain/visit/visit';
import { validateCandidate, type Candidate } from '../../../domain/candidate/candidate';
import { DEFAULT_SETTINGS, normalizeSettings, type Settings } from '../../../domain/settings/settings';
import { validateWish, type Wish } from '../../../domain/wish/wish';
import type { ManualVisit } from '../../../domain/wish/manual-visit';
import type { Memory } from '../../../domain/memory/memory';
import { DEFAULT_HOME_STATE, validateHomeState, type HomeState } from '../../../domain/home/home';
import { validateMapViewState, type MapViewState } from '../../../domain/home/map-view';
import type { ImportBatch, ImportIssue } from '../../../domain/import/import-issue';
import type { IdbDatabase, WriteBuffer } from './database';
import { STORES } from './schema';

/** Shared read/write plumbing: writes go to the buffer, reads overlay the buffer on IndexedDB rows. */
abstract class Repo {
  protected readonly db: IdbDatabase;
  protected readonly buffer: WriteBuffer;

  constructor(db: IdbDatabase, buffer: WriteBuffer) {
    this.db = db;
    this.buffer = buffer;
  }
}

function must<T>(result: Result<T, DomainError>): T {
  if (!result.ok) throw new DomainViolation(result.error);
  return result.value;
}

function put(buffer: WriteBuffer, store: string, key: string, value: unknown): void {
  buffer.touched.add(store);
  const puts = buffer.puts.get(store) ?? new Map<string, unknown>();
  puts.set(key, value);
  buffer.puts.set(store, puts);
  buffer.deletes.get(store)?.delete(key);
}

function remove(buffer: WriteBuffer, store: string, key: string): void {
  buffer.touched.add(store);
  const deletes = buffer.deletes.get(store) ?? new Set<string>();
  deletes.add(key);
  buffer.deletes.set(store, deletes);
  buffer.puts.get(store)?.delete(key);
}

function overlay<T>(buffer: WriteBuffer, store: string, key: string, fallback: T | null): T | null {
  const puts = buffer.puts.get(store);
  if (puts?.has(key)) return puts.get(key) as T;
  if (buffer.deletes.get(store)?.has(key)) return null;
  return fallback;
}

function merge<T>(buffer: WriteBuffer, store: string, rows: readonly T[], keyOf: (row: T) => string): T[] {
  const map = new Map<string, T>();
  for (const row of rows) map.set(keyOf(row), row);
  const puts = buffer.puts.get(store);
  if (puts) for (const [key, value] of puts) map.set(key, value as T);
  const deletes = buffer.deletes.get(store);
  if (deletes) for (const key of deletes) map.delete(key);
  return Array.from(map.values());
}

class Photos extends Repo implements PhotoRepository {

  async get(id: PhotoId): Promise<Photo | null> {
    const row = await this.db.get<Photo>(STORES.photos, id);
    return overlay(this.buffer, STORES.photos, id, row);
  }

  async listAll(): Promise<Photo[]> {
    const rows = await this.db.getAll<Photo>(STORES.photos);
    return merge(this.buffer, STORES.photos, rows, (row) => row.id);
  }

  async listByTrip(tripId: TripId): Promise<Photo[]> {
    const all = await this.listAll();
    return all.filter((photo) => photo.tripId === tripId);
  }

  async listUnassigned(): Promise<Photo[]> {
    const all = await this.listAll();
    return all.filter((photo) => photo.tripId === null);
  }

  async listByCandidate(candidateId: CandidateId): Promise<Photo[]> {
    const all = await this.listAll();
    return all.filter((photo) => photo.candidateId === candidateId);
  }

  async listByVisit(visitId: VisitId): Promise<Photo[]> {
    const all = await this.listAll();
    return all.filter((photo) => photo.visitId === visitId);
  }

  async hashes(): Promise<ReadonlyMap<string, PhotoId>> {
    const all = await this.listAll();
    const map = new Map<string, PhotoId>();
    for (const photo of all) {
      if (photo.contentHash) map.set(photo.contentHash, photo.id);
    }
    return map;
  }

  async saveMany(photos: readonly Photo[]): Promise<void> {
    for (const photo of photos) {
      put(this.buffer, STORES.photos, photo.id, must(validatePhoto(photo)));
    }
  }

  async deleteMany(ids: readonly PhotoId[]): Promise<void> {
    for (const id of ids) remove(this.buffer, STORES.photos, id);
  }
}

class Trips extends Repo implements TripRepository {

  async get(id: TripId): Promise<Trip | null> {
    const row = await this.db.get<Trip>(STORES.trips, id);
    return overlay(this.buffer, STORES.trips, id, row);
  }

  async listAll(): Promise<Trip[]> {
    const rows = await this.db.getAll<Trip>(STORES.trips);
    return merge(this.buffer, STORES.trips, rows, (row) => row.id);
  }

  async save(trip: Trip): Promise<void> {
    put(this.buffer, STORES.trips, trip.id, must(validateTrip(trip)));
  }

  async delete(id: TripId): Promise<void> {
    remove(this.buffer, STORES.trips, id);
  }
}

class Visits extends Repo implements VisitRepository {

  async listAll(): Promise<Visit[]> {
    const rows = await this.db.getAll<Visit>(STORES.visits);
    return merge(this.buffer, STORES.visits, rows, (row) => row.id);
  }

  async listByTrip(tripId: TripId): Promise<Visit[]> {
    const all = await this.listAll();
    return all.filter((visit) => visit.tripId === tripId);
  }

  async saveMany(visits: readonly Visit[]): Promise<void> {
    for (const visit of visits) {
      put(this.buffer, STORES.visits, visit.id, must(validateVisit(visit)));
    }
  }

  async deleteByTrip(tripId: TripId): Promise<void> {
    const rows = await this.db.getAll<Visit>(STORES.visits);
    for (const visit of rows) {
      if (visit.tripId === tripId) remove(this.buffer, STORES.visits, visit.id);
    }
    const puts = this.buffer.puts.get(STORES.visits);
    if (puts) {
      for (const [key, value] of puts) {
        if ((value as Visit).tripId === tripId) {
          puts.delete(key);
          remove(this.buffer, STORES.visits, key);
        }
      }
    }
  }
}

class Candidates extends Repo implements CandidateRepository {

  async get(id: CandidateId): Promise<Candidate | null> {
    const row = await this.db.get<Candidate>(STORES.candidates, id);
    return overlay(this.buffer, STORES.candidates, id, row);
  }

  async listAll(): Promise<Candidate[]> {
    const rows = await this.db.getAll<Candidate>(STORES.candidates);
    return merge(this.buffer, STORES.candidates, rows, (row) => row.id);
  }

  async listByStatus(status: Candidate['status']): Promise<Candidate[]> {
    const all = await this.listAll();
    return all.filter((candidate) => candidate.status === status);
  }

  async save(candidate: Candidate): Promise<void> {
    put(this.buffer, STORES.candidates, candidate.id, must(validateCandidate(candidate)));
  }

  async saveMany(candidates: readonly Candidate[]): Promise<void> {
    for (const candidate of candidates) {
      put(this.buffer, STORES.candidates, candidate.id, must(validateCandidate(candidate)));
    }
  }

  async deleteMany(ids: readonly CandidateId[]): Promise<void> {
    for (const id of ids) remove(this.buffer, STORES.candidates, id);
  }
}

class Memories extends Repo implements MemoryRepository {

  async getByTrip(tripId: TripId): Promise<Memory | null> {
    const row = await this.db.get<Memory>(STORES.memories, tripId);
    return overlay(this.buffer, STORES.memories, tripId, row);
  }

  async listAll(): Promise<Memory[]> {
    const rows = await this.db.getAll<Memory>(STORES.memories);
    return merge(this.buffer, STORES.memories, rows, (row) => row.tripId);
  }

  async save(memory: Memory): Promise<void> {
    put(this.buffer, STORES.memories, memory.tripId, memory);
  }

  async delete(id: string): Promise<void> {
    remove(this.buffer, STORES.memories, id);
  }

  async deleteByTrip(tripId: TripId): Promise<void> {
    remove(this.buffer, STORES.memories, tripId);
  }
}

class Wishes extends Repo implements WishRepository {

  async list(): Promise<Wish[]> {
    const rows = await this.db.getAll<Wish>(STORES.wishes);
    return merge(this.buffer, STORES.wishes, rows, (row) => row.id);
  }

  async get(id: WishId): Promise<Wish | null> {
    const row = await this.db.get<Wish>(STORES.wishes, id);
    return overlay(this.buffer, STORES.wishes, id, row);
  }

  async save(wish: Wish): Promise<void> {
    put(this.buffer, STORES.wishes, wish.id, must(validateWish(wish)));
  }

  async delete(id: WishId): Promise<void> {
    remove(this.buffer, STORES.wishes, id);
  }
}

class ManualVisits extends Repo implements ManualVisitRepository {

  async list(): Promise<ManualVisit[]> {
    const rows = await this.db.getAll<ManualVisit>(STORES.manualVisits);
    return merge(this.buffer, STORES.manualVisits, rows, (row) => row.id);
  }

  async saveMany(visits: readonly ManualVisit[]): Promise<void> {
    for (const visit of visits) put(this.buffer, STORES.manualVisits, visit.id, visit);
  }

  async delete(id: string): Promise<void> {
    remove(this.buffer, STORES.manualVisits, id);
  }

  async deleteByWish(wishId: WishId): Promise<void> {
    const all = await this.list();
    for (const visit of all) {
      if (visit.sourceWishId === wishId) remove(this.buffer, STORES.manualVisits, visit.id);
    }
  }
}

class SettingsRepositoryImpl extends Repo implements SettingsRepository {

  async get(): Promise<Settings> {
    const row = await this.db.get<{ key: string; settings?: Partial<Settings> }>(STORES.settings, 'app');
    const buffered = overlay(this.buffer, STORES.settings, 'app', row);
    return normalizeSettings(buffered?.settings ?? DEFAULT_SETTINGS);
  }

  async save(settings: Settings): Promise<void> {
    put(this.buffer, STORES.settings, 'app', { key: 'app', settings: normalizeSettings(settings) });
  }
}

class HomeRepositoryImpl extends Repo implements HomeRepository {

  async get(): Promise<HomeState> {
    const row = await this.db.get<{ key: string; state?: HomeState }>(STORES.home, 'app');
    const buffered = overlay(this.buffer, STORES.home, 'app', row);
    return buffered?.state ? must(validateHomeState(buffered.state)) : DEFAULT_HOME_STATE;
  }

  async save(home: HomeState): Promise<void> {
    put(this.buffer, STORES.home, 'app', { key: 'app', state: must(validateHomeState(home)) });
  }
}

class MapViewRepositoryImpl extends Repo implements MapViewRepository {

  async get(): Promise<MapViewState | null> {
    const row = await this.db.get<{ key: string; state?: MapViewState }>(STORES.mapView, 'map');
    const buffered = overlay(this.buffer, STORES.mapView, 'map', row);
    return buffered?.state ? must(validateMapViewState(buffered.state)) : null;
  }

  async save(view: MapViewState): Promise<void> {
    put(this.buffer, STORES.mapView, 'map', { key: 'map', state: must(validateMapViewState(view)) });
  }
}

class Batches extends Repo implements ImportBatchRepository {

  async get(id: string): Promise<ImportBatch | null> {
    const row = await this.db.get<ImportBatch>(STORES.importBatches, id);
    return overlay(this.buffer, STORES.importBatches, id, row);
  }

  async listRecent(limit: number): Promise<ImportBatch[]> {
    const rows = await this.db.getAll<ImportBatch>(STORES.importBatches);
    return merge(this.buffer, STORES.importBatches, rows, (row) => row.id)
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, limit);
  }

  async save(batch: ImportBatch): Promise<void> {
    put(this.buffer, STORES.importBatches, batch.id, batch);
  }
}

class Issues extends Repo implements ImportIssueRepository {

  async listByBatch(batchId: string): Promise<ImportIssue[]> {
    const rows = await this.db.getAll<ImportIssue>(STORES.importIssues);
    const merged = merge(this.buffer, STORES.importIssues, rows, (row) => row.id);
    return merged.filter((issue) => issue.batchId === batchId);
  }

  async listRecent(limit: number): Promise<ImportIssue[]> {
    const rows = await this.db.getAll<ImportIssue>(STORES.importIssues);
    return merge(this.buffer, STORES.importIssues, rows, (row) => row.id)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  async saveMany(issues: readonly ImportIssue[]): Promise<void> {
    for (const issue of issues) put(this.buffer, STORES.importIssues, issue.id, issue);
  }
}

class Thumbnails extends Repo implements ThumbnailStore {

  async put(key: string, blob: Blob): Promise<void> {
    put(this.buffer, STORES.blobs, key, { key, blob });
  }

  async get(key: string): Promise<Blob | null> {
    const row = await this.db.get<{ key: string; blob: Blob }>(STORES.blobs, key);
    const value = overlay(this.buffer, STORES.blobs, key, row);
    return value?.blob ?? null;
  }

  async deleteMany(keys: readonly string[]): Promise<void> {
    for (const key of keys) remove(this.buffer, STORES.blobs, key);
  }
}

class Audit extends Repo implements AuditRepository {

  async append(entry: AuditEntry): Promise<void> {
    put(this.buffer, STORES.audit, entry.id, entry);
  }

  async listRecent(limit: number): Promise<AuditEntry[]> {
    const rows = await this.db.getAll<AuditEntry>(STORES.audit);
    return merge(this.buffer, STORES.audit, rows, (row) => row.id)
      .sort((a, b) => b.at - a.at)
      .slice(0, limit);
  }
}

export function createRepositories(db: IdbDatabase, buffer: WriteBuffer): Repositories {
  return {
    photos: new Photos(db, buffer),
    trips: new Trips(db, buffer),
    visits: new Visits(db, buffer),
    candidates: new Candidates(db, buffer),
    memories: new Memories(db, buffer),
    wishes: new Wishes(db, buffer),
    manualVisits: new ManualVisits(db, buffer),
    settings: new SettingsRepositoryImpl(db, buffer),
    home: new HomeRepositoryImpl(db, buffer),
    mapView: new MapViewRepositoryImpl(db, buffer),
    batches: new Batches(db, buffer),
    issues: new Issues(db, buffer),
    thumbnails: new Thumbnails(db, buffer),
    audit: new Audit(db, buffer),
  };
}
