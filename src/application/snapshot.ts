import type { Candidate } from '../domain/candidate/candidate';
import type { ImportBatch, ImportIssue } from '../domain/import/import-issue';
import type { Memory } from '../domain/memory/memory';
import type { Photo } from '../domain/photo/photo';
import type { Settings } from '../domain/settings/settings';
import type { Trip } from '../domain/trip/trip';
import type { Visit } from '../domain/visit/visit';
import type { ManualVisit } from '../domain/wish/manual-visit';
import type { Wish } from '../domain/wish/wish';
import type { Instant } from '../domain/common/time';

export type ArchiveStatus = 'loading' | 'ready' | 'error';

export interface ArchiveSnapshot {
  readonly status: ArchiveStatus;
  readonly error: { code: string; message: string } | null;
  readonly revision: number;
  readonly loadedAt: Instant;
  readonly trips: readonly Trip[];
  readonly photos: readonly Photo[];
  readonly visits: readonly Visit[];
  readonly candidates: readonly Candidate[];
  readonly memories: readonly Memory[];
  readonly wishes: readonly Wish[];
  readonly manualVisits: readonly ManualVisit[];
  readonly settings: Settings;
  readonly batches: readonly ImportBatch[];
  readonly issues: readonly ImportIssue[];
}

export const EMPTY_SETTINGS: Settings = {
  rawPhotoLocal: true,
  cloudSync: false,
  cityLevelOnly: true,
  telemetryOptIn: false,
  reducedMotion: 'system',
  theme: 'system',
  frogHints: true,
};

export const INITIAL_SNAPSHOT: ArchiveSnapshot = {
  status: 'loading',
  error: null,
  revision: 0,
  loadedAt: 0,
  trips: [],
  photos: [],
  visits: [],
  candidates: [],
  memories: [],
  wishes: [],
  manualVisits: [],
  settings: EMPTY_SETTINGS,
  batches: [],
  issues: [],
};
