export type LocationSource = 'exif' | 'candidate' | 'manual' | 'none';

export interface Photo {
  id: string;
  name: string;
  takenAt: number;
  lat?: number;
  lng?: number;
  thumb?: string;
  locationSource: LocationSource;
  /** Demo data only: a human readable place name that overrides city lookup. */
  placeLabel?: string;
  ignored?: boolean;
  candidateId?: string;
  tripId?: string;
  visitId?: string;
}

export interface Visit {
  id: string;
  tripId: string;
  name: string;
  city: string;
  country: string;
  startAt: number;
  endAt: number;
  lat?: number;
  lng?: number;
  photoCount: number;
}

export interface Trip {
  id: string;
  title: string;
  startAt: number;
  endAt: number;
  cityNames: string[];
  visits: Visit[];
  memory: string;
  createdAt: number;
}

export type CandidateStatus = 'pending' | 'ignored';

export interface Candidate {
  id: string;
  startAt: number;
  endAt: number;
  photoIds: string[];
  cityNames: string[];
  locationMissing: number;
  status: CandidateStatus;
}

export interface SplitConfig {
  /** A new trip starts when two neighbouring photos are further apart than this. */
  maxGapHours: number;
  /** A new trip starts when two far-apart places are separated by this much time. */
  maxDistanceKm: number;
  /** ... and the time gap between those far-apart photos is at least this long. */
  farPlaceHours: number;
  /** Trips longer than this are cut at a day boundary. */
  maxTripDays: number;
  /** Photos closer than this are aggregated into one Visit. */
  visitRadiusKm: number;
  /** A Visit ends after this much inactivity. */
  visitGapHours: number;
}

export interface Wish {
  id: string;
  name: string;
  country: string;
  region: string;
  source: string;
  status: 'wish' | 'next';
}

export interface ManualVisited {
  id: string;
  name: string;
  country: string;
  year: number;
}

export interface Settings {
  rawPhotoLocal: boolean;
  cloudSync: boolean;
  cityLevelOnly: boolean;
}

export interface AppData {
  version: 1;
  photos: Record<string, Photo>;
  trips: Trip[];
  candidates: Candidate[];
  wishes: Wish[];
  manualVisited: ManualVisited[];
  settings: Settings;
  config: SplitConfig;
}

export interface CityHit {
  city: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
  distanceKm: number;
}
