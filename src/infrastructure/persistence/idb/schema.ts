export const DB_NAME = 'travel-frog';
export const DB_VERSION = 5;

export interface IndexSpec {
  readonly name: string;
  readonly keyPath: string | string[];
  readonly unique?: boolean;
}

export interface StoreSpec {
  readonly name: string;
  readonly keyPath: string;
  readonly indexes: readonly IndexSpec[];
}

export const STORES = {
  meta: 'meta',
  trips: 'trips',
  photos: 'photos',
  visits: 'visits',
  candidates: 'candidates',
  memories: 'memories',
  wishes: 'wishes',
  manualVisits: 'manualVisits',
  importBatches: 'importBatches',
  importIssues: 'importIssues',
  settings: 'settings',
  home: 'home',
  mapView: 'mapView',
  blobs: 'blobs',
  audit: 'audit',
  migrations: 'migrations',
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

export const SCHEMA_V2: readonly StoreSpec[] = [
  { name: STORES.meta, keyPath: 'key', indexes: [] },
  {
    name: STORES.trips,
    keyPath: 'id',
    indexes: [
      { name: 'by_start', keyPath: 'timeRange.start' },
      { name: 'by_origin', keyPath: 'origin' },
    ],
  },
  {
    name: STORES.photos,
    keyPath: 'id',
    indexes: [
      { name: 'by_trip', keyPath: 'tripId' },
      { name: 'by_visit', keyPath: 'visitId' },
      { name: 'by_candidate', keyPath: 'candidateId' },
      { name: 'by_capturedAt', keyPath: 'capturedAt' },
      { name: 'by_fingerprint', keyPath: 'contentHash', unique: true },
    ],
  },
  {
    name: STORES.visits,
    keyPath: 'id',
    indexes: [
      { name: 'by_trip', keyPath: 'tripId' },
      { name: 'by_start', keyPath: 'timeRange.start' },
    ],
  },
  {
    name: STORES.candidates,
    keyPath: 'id',
    indexes: [
      { name: 'by_status', keyPath: 'status' },
      { name: 'by_start', keyPath: 'timeRange.start' },
    ],
  },
  { name: STORES.memories, keyPath: 'tripId', indexes: [] },
  { name: STORES.wishes, keyPath: 'id', indexes: [{ name: 'by_status', keyPath: 'status' }] },
  { name: STORES.manualVisits, keyPath: 'id', indexes: [{ name: 'by_year', keyPath: 'year' }] },
  { name: STORES.importBatches, keyPath: 'id', indexes: [{ name: 'by_startedAt', keyPath: 'startedAt' }] },
  {
    name: STORES.importIssues,
    keyPath: 'id',
    indexes: [
      { name: 'by_batch', keyPath: 'batchId' },
      { name: 'by_code', keyPath: 'code' },
    ],
  },
  { name: STORES.settings, keyPath: 'key', indexes: [] },
  { name: STORES.blobs, keyPath: 'key', indexes: [] },
  {
    name: STORES.audit,
    keyPath: 'id',
    indexes: [
      { name: 'by_entity', keyPath: 'entity' },
      { name: 'by_at', keyPath: 'at' },
    ],
  },
  { name: STORES.migrations, keyPath: 'version', indexes: [] },
];

export const SCHEMA_V4: readonly StoreSpec[] = [
  { name: STORES.home, keyPath: 'key', indexes: [] },
  { name: STORES.mapView, keyPath: 'key', indexes: [] },
];
