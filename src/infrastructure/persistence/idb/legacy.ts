import { STORES } from './schema';

/** Shape of the v1 single-document archive. Only used for the one-time migration. */
export interface LegacyAppData {
  readonly photos?: Record<string, LegacyPhoto>;
  readonly trips?: readonly LegacyTrip[];
  readonly candidates?: readonly LegacyCandidate[];
  readonly wishes?: readonly LegacyWish[];
  readonly manualVisited?: readonly LegacyManualVisit[];
  readonly settings?: Record<string, unknown>;
}

interface LegacyPhoto {
  id?: string;
  name?: string;
  takenAt?: number;
  lat?: number;
  lng?: number;
  locationSource?: string;
  ignored?: boolean;
  candidateId?: string;
  tripId?: string;
  visitId?: string;
}

interface LegacyVisit {
  id?: string;
  tripId?: string;
  name?: string;
  city?: string;
  country?: string;
  startAt?: number;
  endAt?: number;
  lat?: number;
  lng?: number;
}

interface LegacyTrip {
  id?: string;
  title?: string;
  startAt?: number;
  endAt?: number;
  visits?: readonly LegacyVisit[];
  memory?: string;
  createdAt?: number;
}

interface LegacyCandidate {
  id?: string;
  startAt?: number;
  endAt?: number;
  photoIds?: readonly string[];
  status?: string;
}

interface LegacyWish {
  id?: string;
  name?: string;
  country?: string;
  region?: string;
  status?: string;
}

interface LegacyManualVisit {
  id?: string;
  name?: string;
  country?: string;
  year?: number;
}

const COUNTRY_CODES: Readonly<Record<string, string>> = {
  中国: 'CHN',
  日本: 'JPN',
  韩国: 'KOR',
  泰国: 'THA',
  新加坡: 'SGP',
  马来西亚: 'MYS',
  越南: 'VNM',
  印度尼西亚: 'IDN',
  菲律宾: 'PHL',
  印度: 'IND',
  尼泊尔: 'NPL',
  土耳其: 'TUR',
  阿联酋: 'ARE',
  法国: 'FRA',
  意大利: 'ITA',
  西班牙: 'ESP',
  德国: 'DEU',
  英国: 'GBR',
  荷兰: 'NLD',
  瑞士: 'CHE',
  奥地利: 'AUT',
  捷克: 'CZE',
  希腊: 'GRC',
  葡萄牙: 'PRT',
  冰岛: 'ISL',
  挪威: 'NOR',
  瑞典: 'SWE',
  丹麦: 'DNK',
  芬兰: 'FIN',
  美国: 'USA',
  加拿大: 'CAN',
  墨西哥: 'MEX',
  巴西: 'BRA',
  阿根廷: 'ARG',
  澳大利亚: 'AUS',
  新西兰: 'NZL',
  埃及: 'EGY',
  摩洛哥: 'MAR',
  南非: 'ZAF',
};

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function cityRef(name: string, country: string, lat?: number, lng?: number): Record<string, unknown> {
  const countryCode = COUNTRY_CODES[country] ?? 'XXX';
  const normalized = name.trim().toLocaleLowerCase('zh-CN');
  return {
    key: `${countryCode}:${normalized}`,
    name: name.trim() || '未识别地点',
    countryCode,
    countryName: country || '未知',
    centroid:
      lat !== undefined && lng !== undefined
        ? { lat, lng, accuracyM: null, source: 'manual', approximate: true }
        : null,
    source: 'derived',
    confidence: 'low',
  };
}

function range(start: number, end: number): { start: number; end: number } {
  const safeStart = Number.isFinite(start) ? start : 0;
  const safeEnd = Number.isFinite(end) && end > safeStart ? end : safeStart + 1;
  return { start: safeStart, end: safeEnd };
}

/**
 * Reads the legacy `state` store (single `app-data` key) and writes the new entity stores
 * inside the same versionchange transaction. Existing data is never deleted before a
 * successful conversion; the legacy store itself is dropped with the v1 schema afterwards.
 */
export function migrateLegacyArchive(tx: IDBTransaction, now: number): void {
  if (!tx.db.objectStoreNames.contains('state')) return;
  const legacyStore = tx.objectStore('state');
  const request = legacyStore.get('app-data');
  request.onsuccess = () => {
    const raw = request.result as LegacyAppData | undefined;
    if (!raw || typeof raw !== 'object') return;

    const batches = tx.objectStore(STORES.importBatches);
    batches.put({
      id: 'legacy',
      startedAt: now,
      finishedAt: now,
      sourceFileCount: 0,
      photoCount: 0,
      issueCount: 0,
      candidateCount: 0,
      status: 'completed',
      origin: 'user',
    });

    const photoStore = tx.objectStore(STORES.photos);
    let photoCount = 0;
    for (const [key, photo] of Object.entries(raw.photos ?? {})) {
      const id = str(photo.id, key);
      if (!id) continue;
      const hasGeo = Number.isFinite(photo.lat) && Number.isFinite(photo.lng);
      photoStore.put({
        id,
        importBatchId: 'legacy',
        fileName: str(photo.name, `${id}.jpg`),
        mimeType: 'image/jpeg',
        byteSize: 1,
        contentHash: null,
        capturedAt: num(photo.takenAt, now),
        capturedAtSource: 'file-mtime',
        captureOffsetMinutes: hasGeo ? Math.round((photo.lng ?? 0) / 15) * 60 : null,
        offsetSource: hasGeo ? 'geo-approx' : 'unknown',
        originalCapturedAt: null,
        geo: hasGeo
          ? { lat: photo.lat ?? 0, lng: photo.lng ?? 0, accuracyM: null, source: 'exif', approximate: false }
          : null,
        locationSource: hasGeo ? 'exif' : 'none',
        thumbRef: null,
        tripId: photo.tripId ?? null,
        visitId: photo.visitId ?? null,
        candidateId: photo.candidateId ?? null,
        ignored: Boolean(photo.ignored),
        issues: [],
        origin: 'user',
        importedAt: now,
        updatedAt: now,
      });
      photoCount += 1;
    }
    batches.put({
      id: 'legacy',
      startedAt: now,
      finishedAt: now,
      sourceFileCount: photoCount,
      photoCount,
      issueCount: 0,
      candidateCount: 0,
      status: 'completed',
      origin: 'user',
    });

    const tripStore = tx.objectStore(STORES.trips);
    const visitStore = tx.objectStore(STORES.visits);
    for (const trip of raw.trips ?? []) {
      const id = str(trip.id);
      if (!id) continue;
      const visits = (trip.visits ?? []).filter((visit) => str(visit.id).length > 0);
      const cities: Record<string, unknown>[] = [];
      const seen = new Set<string>();
      visits.forEach((visit, index) => {
        const geo = cityRef(str(visit.city, '未识别地点'), str(visit.country), visit.lat, visit.lng);
        if (!seen.has(String(geo.key))) {
          seen.add(String(geo.key));
          cities.push(geo);
        }
        const visitStart = num(visit.startAt, num(trip.startAt, now));
        const visitEnd = num(visit.endAt, visitStart);
        visitStore.put({
          id: str(visit.id),
          tripId: id,
          sequence: index,
          cityRef: geo,
          displayName: str(visit.name, str(visit.city, '未识别地点')),
          timeRange: range(visitStart, visitEnd + 1),
          geo: visit.lat !== undefined && visit.lng !== undefined ? geo.centroid : null,
          locationSource: visit.lat !== undefined ? 'exif' : 'none',
          confidence: 'low',
        });
      });
      const memoryText = str(trip.memory).trim();
      const memoryId = memoryText.length > 0 ? `memory_${id}` : null;
      tripStore.put({
        id,
        title: str(trip.title, '未命名旅行').slice(0, 40),
        timeRange: range(num(trip.startAt, now), num(trip.endAt, now) + 1),
        cityRefs: cities,
        memoryId,
        coverPhotoId: null,
        sourceCandidateId: null,
        origin: 'user',
        createdAt: num(trip.createdAt, now),
        updatedAt: now,
      });
      if (memoryId) {
        tx.objectStore(STORES.memories).put({
          id: memoryId,
          tripId: id,
          text: memoryText.slice(0, 60),
          origin: 'user',
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    const candidateStore = tx.objectStore(STORES.candidates);
    for (const candidate of raw.candidates ?? []) {
      const id = str(candidate.id);
      if (!id || !candidate.photoIds || candidate.photoIds.length === 0) continue;
      const start = num(candidate.startAt, now);
      const end = Math.max(start + 1, num(candidate.endAt, start + 1));
      candidateStore.put({
        id,
        importBatchId: 'legacy',
        timeRange: { start, end },
        photoIds: [...candidate.photoIds],
        cityRefs: [],
        locationMissingCount: 0,
        splitReasons: ['manual'],
        confidence: 'low',
        status: candidate.status === 'ignored' ? 'ignored' : 'pending',
        derivedFrom: [],
        supersededBy: [],
        confirmedTripId: null,
        origin: 'user',
        createdAt: now,
        updatedAt: now,
      });
    }

    const wishStore = tx.objectStore(STORES.wishes);
    for (const wish of raw.wishes ?? []) {
      const id = str(wish.id);
      if (!id) continue;
      const geo = cityRef(str(wish.name, '未命名地点'), str(wish.country));
      const legacyStatus = wish.status === 'visited' ? 'fulfilled' : 'wished';
      wishStore.put({
        id,
        cityRef: geo,
        region: str(wish.region) || null,
        note: '从旧档案带过来的一个想去的地方。',
        status: legacyStatus,
        source: 'user',
        from: null,
        origin: 'user',
        createdAt: now,
        updatedAt: now,
      });
    }

    const manualStore = tx.objectStore(STORES.manualVisits);
    for (const visit of raw.manualVisited ?? []) {
      const id = str(visit.id);
      if (!id) continue;
      const geo = cityRef(str(visit.name, '未命名地点'), str(visit.country));
      manualStore.put({
        id,
        cityRef: geo,
        year: num(visit.year, new Date(now).getUTCFullYear()),
        source: 'manual',
        sourceWishId: null,
        createdAt: now,
      });
    }
  };
}
