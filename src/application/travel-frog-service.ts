import {
  assertPending,
  markConfirmed,
  markIgnored,
  markRestored,
  markMerged,
  markSplit,
  mergeCandidateRecords,
  splitCandidateRecord,
  type Candidate,
} from '../domain/candidate/candidate';
import { makeCityRef, type CityRef } from '../domain/city/city-ref';
import { asCandidateId, asMemoryId, asTripId, asVisitId, asWishId } from '../domain/common/ids';
import { DomainViolation, type DomainError, type DomainErrorCode } from '../domain/common/result';
import { localYear } from '../domain/common/time';
import { createMemory } from '../domain/memory/memory';
import type { Memory } from '../domain/memory/memory';
import { DEFAULT_SPLIT_CONFIG } from '../domain/services/split-trips';
import { resolveVisits } from '../domain/services/build-visits';
import { suggestLocations } from '../domain/services/fill-locations';
import { normalizeSettings, type Settings } from '../domain/settings/settings';
import { createTrip, findOverlappingTrip, tripTitleFrom, validateTripPhotos } from '../domain/trip/trip';
import type { Trip } from '../domain/trip/trip';
import type { Visit } from '../domain/visit/visit';
import { changeWishStatus, createWish, type Wish, type WishStatus } from '../domain/wish/wish';
import { makeGeoPoint } from '../domain/geo/geo-point';
import type { Clock, CityResolver, ExifReader, FingerprintReader, IdGenerator, Logger, Repositories, ThumbnailGenerator } from '../domain/ports';
import { ArchiveStore } from './archive-store';
import { importPhotos, type ImportProgress, type ImportSummary } from './import-photos';
import { AppError, toAppError, type ArchiveGateway } from './ports';
import { INITIAL_SNAPSHOT, type ArchiveSnapshot } from './snapshot';

export interface ServiceDeps {
  readonly gateway: ArchiveGateway;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly exif: ExifReader;
  readonly thumbnails: ThumbnailGenerator;
  readonly fingerprints: FingerprintReader;
  readonly cityResolver: CityResolver;
  readonly logger: Logger;
}

export interface ArchiveExport {
  readonly version: number;
  readonly exportedAt: number;
  readonly includeCoordinates: boolean;
  readonly trips: readonly Trip[];
  readonly visits: readonly Visit[];
  readonly photos: readonly unknown[];
  readonly candidates: readonly Candidate[];
  readonly memories: readonly Memory[];
  readonly wishes: readonly Wish[];
  readonly manualVisits: readonly unknown[];
  readonly settings: Settings;
}

function fail(code: DomainErrorCode, message: string): never {
  const error: DomainError = { code, message };
  throw new DomainViolation(error);
}

/**
 * Application use cases. Reads produce immutable snapshots; every write is one unit of work.
 * The UI never talks to IndexedDB directly.
 */
export class TravelFrogService {
  readonly store = new ArchiveStore();
  private readonly deps: ServiceDeps;

  constructor(deps: ServiceDeps) {
    this.deps = deps;
  }

  getSnapshot(): ArchiveSnapshot {
    return this.store.getSnapshot();
  }

  subscribe(listener: () => void): () => void {
    return this.store.subscribe(listener);
  }

  private async readAll(): Promise<Omit<ArchiveSnapshot, 'status' | 'error' | 'revision' | 'loadedAt'>> {
    return this.deps.gateway.read(async (repos) => {
      const [trips, photos, visits, candidates, memories, wishes, manualVisits, settings, batches, issues] =
        await Promise.all([
          repos.trips.listAll(),
          repos.photos.listAll(),
          repos.visits.listAll(),
          repos.candidates.listAll(),
          repos.memories.listAll(),
          repos.wishes.list(),
          repos.manualVisits.list(),
          repos.settings.get(),
          repos.batches.listRecent(20),
          repos.issues.listRecent(100),
        ]);
      return {
        trips: trips.sort((a, b) => b.timeRange.end - a.timeRange.end),
        photos,
        visits: visits.sort((a, b) => a.timeRange.start - b.timeRange.start),
        candidates: candidates.sort((a, b) => a.timeRange.start - b.timeRange.start),
        memories,
        wishes,
        manualVisits,
        settings,
        batches,
        issues,
      };
    });
  }

  async load(): Promise<void> {
    this.store.patch({ status: 'loading', error: null });
    try {
      const data = await this.readAll();
      this.store.set({
        ...data,
        status: 'ready',
        error: null,
        revision: this.store.getSnapshot().revision + 1,
        loadedAt: this.deps.clock.now(),
      });
    } catch (error) {
      const app = toAppError(error, 'STORAGE_OPEN_FAILED', '无法打开本地档案');
      this.deps.logger.error('archive.load-failed', error);
      this.store.set({
        ...INITIAL_SNAPSHOT,
        status: 'error',
        error: { code: app.code, message: app.message },
        revision: this.store.getSnapshot().revision + 1,
        loadedAt: this.deps.clock.now(),
      });
    }
  }

  private async refresh(): Promise<void> {
    const data = await this.readAll();
    this.store.set({
      ...data,
      status: 'ready',
      error: null,
      revision: this.store.getSnapshot().revision + 1,
      loadedAt: this.deps.clock.now(),
    });
  }

  private offset(): number {
    return this.deps.clock.localOffsetMinutes(this.deps.clock.now());
  }

  async importFiles(files: readonly File[], onProgress?: (progress: ImportProgress) => void): Promise<ImportSummary> {
    try {
      const summary = await importPhotos(
        {
          gateway: this.deps.gateway,
          clock: this.deps.clock,
          ids: this.deps.ids,
          exif: this.deps.exif,
          thumbnails: this.deps.thumbnails,
          fingerprints: this.deps.fingerprints,
          cityResolver: this.deps.cityResolver,
          logger: this.deps.logger,
        },
        files,
        ...(onProgress ? [onProgress] : []),
      );
      await this.refresh();
      return summary;
    } catch (error) {
      this.deps.logger.error('import.failed', error);
      throw toAppError(error, 'IMPORT_FAILED', '导入失败，请重试');
    }
  }

  private async loadCandidate(repos: Repositories, id: string): Promise<Candidate> {
    const candidate = await repos.candidates.get(asCandidateId(id));
    if (!candidate) fail('CANDIDATE_NOT_FOUND', '候选不存在');
    const pending = assertPending(candidate, asCandidateId(id));
    if (!pending.ok) throw new DomainViolation(pending.error);
    return pending.value;
  }

  async confirmCandidate(candidateId: string, title?: string): Promise<string> {
    const now = this.deps.clock.now();
    const tripId = asTripId(this.deps.ids.newTripId());
    try {
      await this.deps.gateway.run(async (repos) => {
        const candidate = await this.loadCandidate(repos, candidateId);
        const allPhotos = await repos.photos.listAll();
        const photoIds = new Set(candidate.photoIds);
        const members = allPhotos.filter((photo) => photoIds.has(photo.id));
        if (members.length === 0) throw new DomainViolation({ code: 'CANDIDATE_EMPTY', message: '候选没有照片' });
        const trips = await repos.trips.listAll();
        const overlap = findOverlappingTrip(trips, candidate.timeRange);
        if (overlap) {
          throw new DomainViolation({ code: 'TRIP_TIME_OVERLAP', message: `与「${overlap.title}」时间重叠，请先调整` });
        }
        const resolvedTitle =
          title?.trim() || tripTitleFrom(localYear(candidate.timeRange.start, this.offset()), candidate.cityRefs);
        const tripResult = createTrip({
          id: tripId,
          title: resolvedTitle,
          timeRange: candidate.timeRange,
          cityRefs: candidate.cityRefs,
          coverPhotoId: members[0]?.id ?? null,
          sourceCandidateId: candidate.id,
          origin: candidate.origin,
          createdAt: now,
        });
        if (!tripResult.ok) throw new DomainViolation(tripResult.error);

        const assigned = allPhotos.map((photo) =>
          photoIds.has(photo.id) ? { ...photo, tripId, visitId: null, updatedAt: now } : photo,
        );
        const visits = resolveVisits({
          tripId,
          photos: assigned.filter((photo) => photo.tripId === tripId),
          config: DEFAULT_SPLIT_CONFIG,
          resolveCity: (geo) => this.deps.cityResolver.resolve(geo),
          defaultOffsetMinutes: this.offset(),
          now,
        });
        if (!visits.ok) throw new DomainViolation(visits.error);

        const withVisits = assigned.map((photo) => {
          const visitId = visits.value.photoVisitIds.get(photo.id);
          return visitId ? { ...photo, visitId } : photo;
        });
        const tripPhotos = withVisits.filter((photo) => photo.tripId === tripId);
        const check = validateTripPhotos({ ...tripResult.value, coverPhotoId: tripPhotos[0]?.id ?? null }, tripPhotos);
        if (!check.ok) throw new DomainViolation(check.error);

        await repos.trips.save({ ...tripResult.value, coverPhotoId: tripPhotos[0]?.id ?? null });
        await repos.visits.saveMany(visits.value.visits);
        await repos.photos.saveMany(withVisits);
        await repos.candidates.save(markConfirmed(candidate, tripId, now));
        const wished = await repos.wishes.list();
        for (const wish of wished) {
          if (wish.status !== 'wished') continue;
          if (!candidate.cityRefs.some((ref) => ref.key === wish.cityRef.key)) continue;
          const fulfilled = changeWishStatus(wish, 'fulfilled', now);
          if (fulfilled.ok) await repos.wishes.save(fulfilled.value);
        }
      });
    } catch (error) {
      this.deps.logger.error('candidate.confirm-failed', error, { candidateId });
      throw toAppError(error, 'TRIP_CREATE_FAILED', '确认候选失败');
    }
    await this.refresh();
    return tripId;
  }

  async confirmAll(): Promise<number> {
    const pending = this.store.getSnapshot().candidates.filter((candidate) => candidate.status === 'pending');
    let confirmed = 0;
    for (const candidate of pending) {
      try {
        await this.confirmCandidate(candidate.id);
        confirmed += 1;
      } catch (error) {
        this.deps.logger.error('candidate.confirm-all-failed', error, { candidateId: candidate.id });
      }
    }
    return confirmed;
  }

  async ignoreCandidate(candidateId: string): Promise<void> {
    const now = this.deps.clock.now();
    await this.deps.gateway.run(async (repos) => {
      const candidate = await this.loadCandidate(repos, candidateId);
      await repos.candidates.save(markIgnored(candidate, now));
      const photos = await repos.photos.listAll();
      const ids = new Set(candidate.photoIds);
      await repos.photos.saveMany(
        photos.filter((photo) => ids.has(photo.id)).map((photo) => ({ ...photo, ignored: true, updatedAt: now })),
      );
    });
    await this.refresh();
  }

  async restoreCandidate(candidateId: string): Promise<void> {
    const now = this.deps.clock.now();
    try {
      await this.deps.gateway.run(async (repos) => {
        const candidate = await repos.candidates.get(asCandidateId(candidateId));
        if (!candidate) fail('CANDIDATE_NOT_FOUND', '候选不存在');
        const restored = markRestored(candidate, now);
        if (!restored.ok) throw new DomainViolation(restored.error);
        await repos.candidates.save(restored.value);
        const photos = await repos.photos.listAll();
        const ids = new Set(candidate.photoIds);
        await repos.photos.saveMany(
          photos.filter((photo) => ids.has(photo.id)).map((photo) => ({ ...photo, ignored: false, updatedAt: now })),
        );
      });
    } catch (error) {
      throw toAppError(error, 'CANDIDATE_RESTORE_FAILED', '恢复候选失败');
    }
    await this.refresh();
  }

  async mergeCandidates(firstId: string, secondId: string): Promise<string> {
    const now = this.deps.clock.now();
    const newId = this.deps.ids.newCandidateId();
    try {
      await this.deps.gateway.run(async (repos) => {
        const a = await this.loadCandidate(repos, firstId);
        const b = await this.loadCandidate(repos, secondId);
        const photos = await repos.photos.listAll();
        const merged = mergeCandidateRecords({
          a,
          b,
          photos,
          newId,
          resolveCity: (geo) => this.deps.cityResolver.resolve(geo),
          defaultOffsetMinutes: this.offset(),
          now,
        });
        if (!merged.ok) throw new DomainViolation(merged.error);
        const idSet = new Set([...a.photoIds, ...b.photoIds]);
        await repos.candidates.saveMany([markMerged(a, asCandidateId(newId), now), markMerged(b, asCandidateId(newId), now), merged.value]);
        await repos.photos.saveMany(
          photos.filter((photo) => idSet.has(photo.id)).map((photo) => ({ ...photo, candidateId: newId, updatedAt: now })),
        );
      });
    } catch (error) {
      throw toAppError(error, 'MERGE_FAILED', '合并候选失败');
    }
    await this.refresh();
    return newId;
  }

  async splitCandidate(candidateId: string, at: number): Promise<readonly string[]> {
    const now = this.deps.clock.now();
    const leftId = this.deps.ids.newCandidateId();
    const rightId = this.deps.ids.newCandidateId();
    try {
      await this.deps.gateway.run(async (repos) => {
        const candidate = await this.loadCandidate(repos, candidateId);
        const photos = await repos.photos.listAll();
        const parts = splitCandidateRecord({
          candidate,
          at,
          photos,
          ids: [leftId, rightId],
          resolveCity: (geo) => this.deps.cityResolver.resolve(geo),
          defaultOffsetMinutes: this.offset(),
          now,
        });
        if (!parts.ok) throw new DomainViolation(parts.error);
        const [left, right] = parts.value;
        const leftSet = new Set(left.photoIds);
        await repos.candidates.saveMany([markSplit(candidate, [left.id, right.id], now), left, right]);
        await repos.photos.saveMany(
          photos
            .filter((photo) => candidate.photoIds.includes(photo.id))
            .map((photo) => ({ ...photo, candidateId: leftSet.has(photo.id) ? left.id : right.id, updatedAt: now })),
        );
      });
    } catch (error) {
      throw toAppError(error, 'SPLIT_FAILED', '拆分候选失败');
    }
    await this.refresh();
    return [leftId, rightId];
  }

  async updateTrip(tripId: string, patch: { title?: string }): Promise<void> {
    const now = this.deps.clock.now();
    await this.deps.gateway.run(async (repos) => {
      const trip = await repos.trips.get(asTripId(tripId));
      if (!trip) fail('TRIP_NOT_FOUND', '旅程不存在');
      const title = patch.title === undefined ? trip.title : patch.title.trim();
      if (title.length === 0 || title.length > 40) {
        fail('VALIDATION_FAILED', '标题需要在 1–40 字之间');
      }
      await repos.trips.save({ ...trip, title, updatedAt: now });
    });
    await this.refresh();
  }

  async saveMemory(tripId: string, text: string): Promise<void> {
    const now = this.deps.clock.now();
    const trimmed = text.trim();
    await this.deps.gateway.run(async (repos) => {
      const trip = await repos.trips.get(asTripId(tripId));
      if (!trip) fail('TRIP_NOT_FOUND', '旅程不存在');
      const existing = await repos.memories.getByTrip(asTripId(tripId));
      if (trimmed.length === 0) {
        if (existing) await repos.memories.deleteByTrip(asTripId(tripId));
        await repos.trips.save({ ...trip, memoryId: null, updatedAt: now });
        return;
      }
      const created = createMemory({
        id: existing?.id ?? this.deps.ids.newMemoryId(),
        tripId: asTripId(tripId),
        text: trimmed,
        origin: trip.origin,
        now,
      });
      if (!created.ok) throw new DomainViolation(created.error);
      const memory = existing ? { ...created.value, id: asMemoryId(existing.id) } : created.value;
      await repos.memories.save(memory);
      await repos.trips.save({ ...trip, memoryId: asMemoryId(memory.id), updatedAt: now });
    });
    await this.refresh();
  }

  async deleteTrip(tripId: string): Promise<void> {
    const now = this.deps.clock.now();
    await this.deps.gateway.run(async (repos) => {
      const id = asTripId(tripId);
      const photos = await repos.photos.listAll();
      await repos.memories.deleteByTrip(id);
      await repos.visits.deleteByTrip(id);
      await repos.trips.delete(id);
      await repos.photos.saveMany(
        photos
          .filter((photo) => photo.tripId === id)
          .map((photo) => ({ ...photo, tripId: null, visitId: null, candidateId: null, updatedAt: now })),
      );
    });
    await this.refresh();
  }

  async thumbnail(photoId: string): Promise<Blob | null> {
    return this.deps.gateway.read(async (repos) => {
      const photo = await repos.photos.get(photoId as never);
      if (!photo || !photo.thumbRef) return null;
      return repos.thumbnails.get(photo.thumbRef);
    });
  }

  suggestions(): ReturnType<typeof suggestLocations> {
    const snapshot = this.store.getSnapshot();
    return suggestLocations({
      photos: snapshot.photos,
      config: DEFAULT_SPLIT_CONFIG,
      resolveCity: (geo) => this.deps.cityResolver.resolve(geo),
      defaultOffsetMinutes: this.offset(),
    });
  }

  async applyLocationSuggestions(photoIds: readonly string[]): Promise<number> {
    const now = this.deps.clock.now();
    const selected = new Set(photoIds);
    const suggestions = this.suggestions().filter((item) => selected.has(item.photoId));
    if (suggestions.length === 0) return 0;
    const byPhoto = new Map(suggestions.map((item) => [item.photoId, item]));
    try {
      await this.deps.gateway.run(async (repos) => {
        const photos = await repos.photos.listAll();
        const updated = photos.map((photo) => {
          const suggestion = byPhoto.get(photo.id);
          if (!suggestion) return photo;
          return {
            ...photo,
            geo: suggestion.geo,
            locationSource: 'candidate' as const,
            updatedAt: now,
          };
        });
        const affectedTrips = new Set(
          updated.filter((photo) => byPhoto.has(photo.id) && photo.tripId !== null).map((photo) => photo.tripId as string),
        );
        const rebuiltVisits: Visit[] = [];
        const visitByPhoto = new Map<string, string>();
        for (const tripId of affectedTrips) {
          const id = asTripId(tripId);
          await repos.visits.deleteByTrip(id);
          const trip = await repos.trips.get(id);
          if (!trip) continue;
          const members = updated.filter((photo) => photo.tripId === id);
          const visits = resolveVisits({
            tripId: id,
            photos: members,
            config: DEFAULT_SPLIT_CONFIG,
            resolveCity: (geo) => this.deps.cityResolver.resolve(geo),
            defaultOffsetMinutes: this.offset(),
            now,
          });
          if (!visits.ok) throw new DomainViolation(visits.error);
          rebuiltVisits.push(...visits.value.visits);
          for (const [photoId, visitId] of visits.value.photoVisitIds) visitByPhoto.set(photoId, visitId);
        }
        const finalPhotos = updated.map((photo) => {
          if (photo.tripId !== null && affectedTrips.has(photo.tripId)) {
            const visitId = visitByPhoto.get(photo.id);
            return { ...photo, visitId: visitId ? asVisitId(visitId) : null };
          }
          return photo;
        });
        await repos.visits.saveMany(rebuiltVisits);
        await repos.photos.saveMany(
          finalPhotos.filter((photo) => byPhoto.has(photo.id) || (photo.tripId !== null && affectedTrips.has(photo.tripId))),
        );
      });
    } catch (error) {
      throw toAppError(error, 'FILL_FAILED', '写入位置失败');
    }
    await this.refresh();
    return suggestions.length;
  }

  async addWish(input: {
    name: string;
    region: string;
    countryCode?: string;
    lat?: number;
    lng?: number;
    notes?: string;
  }): Promise<string> {
    const now = this.deps.clock.now();
    const name = input.name.trim();
    if (name.length === 0) throw new AppError('INVALID_INPUT', '请填写想去的地方');
    const resolved = this.deps.cityResolver.resolveByName(name, input.countryCode);
    let cityRef: CityRef;
    if (resolved) {
      cityRef = resolved;
    } else {
      let centroid: CityRef['centroid'] = null;
      if (input.lat !== undefined && input.lng !== undefined) {
        const geo = makeGeoPoint({ lat: input.lat, lng: input.lng, source: 'manual', approximate: true });
        if (!geo.ok) throw new DomainViolation(geo.error);
        centroid = geo.value;
      }
      cityRef = makeCityRef({
        name,
        countryCode: input.countryCode?.trim().toUpperCase() || 'XXX',
        countryName: input.region.trim() || '未知',
        centroid,
        source: 'manual',
        confidence: 'low',
      });
    }
    const id = this.deps.ids.newWishId();
    const wish = createWish({
      id,
      cityRef,
      region: input.region.trim() || null,
      note: input.notes?.trim() || null,
      status: 'pending',
      source: 'user',
      from: null,
      origin: 'user',
      now,
    });
    if (!wish.ok) throw new DomainViolation(wish.error);
    await this.deps.gateway.run(async (repos) => {
      await repos.wishes.save(wish.value);
    });
    await this.refresh();
    return id;
  }

  /** pending -> received when the frog comes back with a written postcard. */
  async deliverWish(wishId: string, input: { note: string; from?: string | null }): Promise<void> {
    const now = this.deps.clock.now();
    await this.deps.gateway.run(async (repos) => {
      const wish = await repos.wishes.get(asWishId(wishId));
      if (!wish) fail('WISH_STATE_INVALID', '明信片不存在');
      const next = changeWishStatus(wish, 'received', now, { note: input.note, from: input.from ?? wish.from });
      if (!next.ok) throw new DomainViolation(next.error);
      await repos.wishes.save(next.value);
    });
    await this.refresh();
  }

  async setWishStatus(wishId: string, status: WishStatus): Promise<void> {
    const now = this.deps.clock.now();
    await this.deps.gateway.run(async (repos) => {
      const wish = await repos.wishes.get(asWishId(wishId));
      if (!wish) fail('WISH_STATE_INVALID', '明信片不存在');
      const next = changeWishStatus(wish, status, now);
      if (!next.ok) throw new DomainViolation(next.error);
      await repos.wishes.save(next.value);
    });
    await this.refresh();
  }

  async deleteWish(wishId: string): Promise<void> {
    await this.deps.gateway.run(async (repos) => {
      await repos.manualVisits.deleteByWish(asWishId(wishId));
      await repos.wishes.delete(asWishId(wishId));
    });
    await this.refresh();
  }

  async saveSettings(patch: Partial<Settings>): Promise<void> {
    const settings = normalizeSettings({ ...this.store.getSnapshot().settings, ...patch });
    await this.deps.gateway.run(async (repos) => {
      await repos.settings.save(settings);
    });
    await this.refresh();
  }

  async exportArchive(includeCoordinates: boolean): Promise<ArchiveExport> {
    const data = await this.readAll();
    return {
      version: 3,
      exportedAt: this.deps.clock.now(),
      includeCoordinates,
      trips: data.trips,
      visits: data.visits,
      photos: data.photos.map((photo) => ({
        ...photo,
        geo: includeCoordinates ? photo.geo : null,
        locationSource: includeCoordinates ? photo.locationSource : 'none',
        thumbRef: null,
      })),
      candidates: data.candidates,
      memories: data.memories,
      wishes: data.wishes,
      manualVisits: data.manualVisits.map((visit) => ({
        city: visit.cityRef.name,
        country: visit.cityRef.countryName,
        year: visit.year,
        source: visit.source,
      })),
      settings: data.settings,
    };
  }

  async deleteAll(): Promise<void> {
    await this.deps.gateway.clear();
    this.store.set({
      ...INITIAL_SNAPSHOT,
      status: 'ready',
      error: null,
      revision: this.store.getSnapshot().revision + 1,
      loadedAt: this.deps.clock.now(),
    });
  }

  async loadDemo(): Promise<void> {
    const { buildDemoArchive } = await import('../infrastructure/demo/demo-archive');
    const now = this.deps.clock.now();
    const demo = buildDemoArchive(now);
    await this.deps.gateway.run(async (repos) => {
      await repos.batches.save(demo.batch);
      for (const trip of demo.trips) await repos.trips.save(trip);
      await repos.visits.saveMany(demo.visits);
      if (demo.photos.length > 0) await repos.photos.saveMany(demo.photos);
      if (demo.candidates.length > 0) await repos.candidates.saveMany(demo.candidates);
      if (demo.memories.length > 0) {
        for (const memory of demo.memories) await repos.memories.save(memory);
      }
      if (demo.wishes.length > 0) {
        for (const wish of demo.wishes) await repos.wishes.save(wish);
      }
      if (demo.manualVisits.length > 0) await repos.manualVisits.saveMany(demo.manualVisits);
    });
    await this.refresh();
  }

  async removeDemo(): Promise<void> {
    await this.deps.gateway.run(async (repos) => {
      const [trips, photos, candidates, wishes, memories] = await Promise.all([
        repos.trips.listAll(),
        repos.photos.listAll(),
        repos.candidates.listAll(),
        repos.wishes.list(),
        repos.memories.listAll(),
      ]);
      const demoTrips = trips.filter((trip) => trip.origin === 'demo');
      for (const trip of demoTrips) {
        await repos.visits.deleteByTrip(trip.id);
        await repos.memories.deleteByTrip(trip.id);
        await repos.trips.delete(trip.id);
      }
      await repos.photos.deleteMany(photos.filter((photo) => photo.origin === 'demo').map((photo) => photo.id));
      await repos.candidates.deleteMany(candidates.filter((item) => item.origin === 'demo').map((item) => item.id));
      for (const wish of wishes.filter((item) => item.origin === 'demo')) {
        await repos.manualVisits.deleteByWish(wish.id);
        await repos.wishes.delete(wish.id);
      }
      for (const memory of memories.filter((item) => item.origin === 'demo')) {
        await repos.memories.delete(memory.id);
      }
    });
    await this.refresh();
  }
}
