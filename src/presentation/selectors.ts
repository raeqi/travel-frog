import type { ArchiveSnapshot } from '../application/snapshot';
import type { Candidate } from '../domain/candidate/candidate';
import type { Memory } from '../domain/memory/memory';
import type { Photo } from '../domain/photo/photo';
import { computeFootprint, computeGaps, type Footprint, type GapReport } from '../domain/services/statistics';
import type { Trip } from '../domain/trip/trip';
import type { Visit } from '../domain/visit/visit';

export function pendingCandidates(snapshot: ArchiveSnapshot): Candidate[] {
  return snapshot.candidates.filter((candidate) => candidate.status === 'pending');
}

export function tripOf(snapshot: ArchiveSnapshot, tripId: string | null): Trip | null {
  if (tripId) return snapshot.trips.find((trip) => trip.id === tripId) ?? null;
  return snapshot.trips[0] ?? null;
}

export function photosOfTrip(snapshot: ArchiveSnapshot, tripId: string): Photo[] {
  return snapshot.photos
    .filter((photo) => photo.tripId === tripId)
    .sort((a, b) => a.capturedAt - b.capturedAt);
}

export function visitsOfTrip(snapshot: ArchiveSnapshot, tripId: string): Visit[] {
  return snapshot.visits.filter((visit) => visit.tripId === tripId).sort((a, b) => a.sequence - b.sequence);
}

export function memoryOf(snapshot: ArchiveSnapshot, trip: Trip): Memory | null {
  return snapshot.memories.find((memory) => memory.tripId === trip.id) ?? null;
}

/** The capture offset shared by a set of photos; the first known EXIF offset wins. */
export function captureOffsetOf(photos: readonly Photo[]): number | null {
  for (const photo of photos) {
    if (photo.captureOffsetMinutes !== null) return photo.captureOffsetMinutes;
  }
  return null;
}

export function offsetOfTrip(snapshot: ArchiveSnapshot, tripId: string): number | null {
  return captureOffsetOf(photosOfTrip(snapshot, tripId));
}

export function tripOffsets(snapshot: ArchiveSnapshot): ReadonlyMap<string, number | null> {
  const offsets = new Map<string, number | null>();
  for (const photo of snapshot.photos) {
    if (photo.tripId === null) continue;
    const known = offsets.get(photo.tripId) ?? null;
    if (known === null && photo.captureOffsetMinutes !== null) {
      offsets.set(photo.tripId, photo.captureOffsetMinutes);
    } else if (!offsets.has(photo.tripId)) {
      offsets.set(photo.tripId, null);
    }
  }
  return offsets;
}

export function unlocatedPhotos(snapshot: ArchiveSnapshot): Photo[] {
  return snapshot.photos
    .filter((photo) => photo.geo === null && !photo.ignored)
    .sort((a, b) => a.capturedAt - b.capturedAt);
}

export function photosByIds(snapshot: ArchiveSnapshot, ids: readonly string[]): Photo[] {
  const set = new Set(ids);
  return snapshot.photos.filter((photo) => set.has(photo.id)).sort((a, b) => a.capturedAt - b.capturedAt);
}

export function footprintOf(snapshot: ArchiveSnapshot, year: number | null): Footprint {
  const base = {
    trips: snapshot.trips,
    visits: snapshot.visits,
    photos: snapshot.photos,
    manualVisits: snapshot.manualVisits,
  };
  return computeFootprint(year === null ? base : { ...base, year });
}

export function gapsOf(snapshot: ArchiveSnapshot): GapReport {
  return computeGaps({
    trips: snapshot.trips,
    visits: snapshot.visits,
    photos: snapshot.photos,
    wishes: snapshot.wishes,
    memories: snapshot.memories,
  });
}

export function tripYears(snapshot: ArchiveSnapshot): number[] {
  const years = new Set<number>();
  for (const trip of snapshot.trips) years.add(new Date(trip.timeRange.end - 1).getUTCFullYear());
  for (const visit of snapshot.manualVisits) years.add(visit.year);
  return Array.from(years).sort((a, b) => b - a);
}

export function totalUnlocated(snapshot: ArchiveSnapshot): number {
  return unlocatedPhotos(snapshot).length;
}

export function tripsWithoutMemory(snapshot: ArchiveSnapshot): Trip[] {
  return snapshot.trips.filter((trip) => !snapshot.memories.some((memory) => memory.tripId === trip.id));
}
