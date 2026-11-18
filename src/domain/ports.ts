import type {
  CandidateId,
  ImportBatchId,
  ManualVisitId,
  MemoryId,
  PhotoId,
  TripId,
  VisitId,
  WishId,
} from './common/ids';
import type { Instant } from './common/time';
import type { Candidate } from './candidate/candidate';
import type { CityRef } from './city/city-ref';
import type { GeoPoint } from './geo/geo-point';
import type { HomeState } from './home/home';
import type { MapViewState } from './home/map-view';
import type { ImportBatch, ImportIssue } from './import/import-issue';
import type { Memory } from './memory/memory';
import type { Photo } from './photo/photo';
import type { Settings } from './settings/settings';
import type { Trip } from './trip/trip';
import type { Visit } from './visit/visit';
import type { ManualVisit } from './wish/manual-visit';
import type { Wish } from './wish/wish';
import type { FrogTravelState } from './frog/journey';

export interface FrogTravelRepository {
  get(): Promise<FrogTravelState | null>;
  save(state: FrogTravelState): Promise<void>;
}

export interface PhotoRepository {
  get(id: PhotoId): Promise<Photo | null>;
  listAll(): Promise<Photo[]>;
  listByTrip(tripId: TripId): Promise<Photo[]>;
  listUnassigned(): Promise<Photo[]>;
  listByCandidate(candidateId: CandidateId): Promise<Photo[]>;
  listByVisit(visitId: VisitId): Promise<Photo[]>;
  /** Content hash -> photo id, used to avoid importing the same file twice. */
  hashes(): Promise<ReadonlyMap<string, PhotoId>>;
  saveMany(photos: readonly Photo[]): Promise<void>;
  deleteMany(ids: readonly PhotoId[]): Promise<void>;
}

export interface TripRepository {
  get(id: TripId): Promise<Trip | null>;
  listAll(): Promise<Trip[]>;
  save(trip: Trip): Promise<void>;
  delete(id: TripId): Promise<void>;
}

export interface VisitRepository {
  listAll(): Promise<Visit[]>;
  listByTrip(tripId: TripId): Promise<Visit[]>;
  saveMany(visits: readonly Visit[]): Promise<void>;
  deleteByTrip(tripId: TripId): Promise<void>;
}

export interface CandidateRepository {
  get(id: CandidateId): Promise<Candidate | null>;
  listAll(): Promise<Candidate[]>;
  listByStatus(status: Candidate['status']): Promise<Candidate[]>;
  save(candidate: Candidate): Promise<void>;
  saveMany(candidates: readonly Candidate[]): Promise<void>;
  deleteMany(ids: readonly CandidateId[]): Promise<void>;
}

export interface MemoryRepository {
  getByTrip(tripId: TripId): Promise<Memory | null>;
  listAll(): Promise<Memory[]>;
  save(memory: Memory): Promise<void>;
  delete(id: MemoryId): Promise<void>;
  deleteByTrip(tripId: TripId): Promise<void>;
}

export interface WishRepository {
  list(): Promise<Wish[]>;
  get(id: WishId): Promise<Wish | null>;
  save(wish: Wish): Promise<void>;
  delete(id: WishId): Promise<void>;
}

export interface ManualVisitRepository {
  list(): Promise<ManualVisit[]>;
  saveMany(visits: readonly ManualVisit[]): Promise<void>;
  delete(id: ManualVisitId): Promise<void>;
  deleteByWish(wishId: WishId): Promise<void>;
}

export interface SettingsRepository {
  get(): Promise<Settings>;
  save(settings: Settings): Promise<void>;
}

export interface HomeRepository {
  get(): Promise<HomeState>;
  save(home: HomeState): Promise<void>;
}

export interface MapViewRepository {
  get(): Promise<MapViewState | null>;
  save(view: MapViewState): Promise<void>;
}

export interface ImportBatchRepository {
  get(id: ImportBatchId): Promise<ImportBatch | null>;
  listRecent(limit: number): Promise<ImportBatch[]>;
  save(batch: ImportBatch): Promise<void>;
}

export interface ImportIssueRepository {
  listByBatch(batchId: ImportBatchId): Promise<ImportIssue[]>;
  listRecent(limit: number): Promise<ImportIssue[]>;
  saveMany(issues: readonly ImportIssue[]): Promise<void>;
}

export interface ThumbnailStore {
  put(key: string, blob: Blob): Promise<void>;
  get(key: string): Promise<Blob | null>;
  deleteMany(keys: readonly string[]): Promise<void>;
}

export interface AuditEntry {
  readonly id: string;
  readonly entity: string;
  readonly entityId: string;
  readonly action: string;
  readonly detail: string;
  readonly at: Instant;
}

export interface AuditRepository {
  append(entry: AuditEntry): Promise<void>;
  listRecent(limit: number): Promise<AuditEntry[]>;
}

export interface Repositories {
  readonly photos: PhotoRepository;
  readonly trips: TripRepository;
  readonly visits: VisitRepository;
  readonly candidates: CandidateRepository;
  readonly memories: MemoryRepository;
  readonly wishes: WishRepository;
  readonly manualVisits: ManualVisitRepository;
  readonly settings: SettingsRepository;
  readonly home: HomeRepository;
  readonly frogTravel: FrogTravelRepository;
  readonly mapView: MapViewRepository;
  readonly batches: ImportBatchRepository;
  readonly issues: ImportIssueRepository;
  readonly thumbnails: ThumbnailStore;
  readonly audit: AuditRepository;
}

/**
 * One use case = one unit of work. Repository writes are buffered and flushed in a single
 * IndexedDB transaction; any thrown error aborts the whole commit.
 */
export interface UnitOfWork {
  run<T>(work: (repos: Repositories) => Promise<T>): Promise<T>;
}

export interface Clock {
  now(): Instant;
  localOffsetMinutes(at: Instant): number;
}

export interface IdGenerator {
  newPhotoId(): string;
  newTripId(): string;
  newVisitId(): string;
  newCandidateId(): string;
  newMemoryId(): string;
  newWishId(): string;
  newManualVisitId(): string;
  newImportBatchId(): string;
  newImportIssueId(): string;
  newAuditId(): string;
}

export interface ExifData {
  readonly capturedAt: Instant | null;
  readonly capturedAtSource: 'exif-original' | 'exif-datetime' | null;
  readonly offsetMinutes: number | null;
  readonly geo: { lat: number; lng: number } | null;
  readonly orientation: number | null;
  readonly mimeType: string | null;
  readonly error: string | null;
}

export interface ExifReader {
  read(file: File): Promise<ExifData>;
}

export interface ThumbnailGenerator {
  create(file: File, maxEdge: number): Promise<Blob | null>;
}

export interface FingerprintReader {
  hash(file: File): Promise<{ hash: string; weak: boolean }>;
}

export interface CityResolver {
  resolve(geo: GeoPoint): CityRef | null;
  resolveByName(name: string, countryCode?: string): CityRef | null;
  suggest(query: string, limit: number): CityRef[];
}

export interface Logger {
  debug(event: string, fields?: Record<string, unknown>): void;
  warn(event: string, fields?: Record<string, unknown>): void;
  error(event: string, error: unknown, fields?: Record<string, unknown>): void;
  recent(limit: number): readonly { at: Instant; level: string; event: string; fields: Record<string, unknown> }[];
}
