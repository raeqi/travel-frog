import { describe, expect, it } from 'vitest';
import { assertPending, createCandidate, markIgnored, markRestored } from './candidate/candidate';
import { makeCityRef, type CityRef } from './city/city-ref';
import { asCandidateId } from './common/ids';
import { makeTimeRange } from './common/time';
import { makeGeoPoint } from './geo/geo-point';
import { createMemory, MEMORY_MAX_CODE_POINTS } from './memory/memory';
import { createPhoto } from './photo/photo';
import { createTrip, findOverlappingTrip, validateTripSet, validateTripPhotos } from './trip/trip';
import { changeWishStatus, createWish, validateWish } from './wish/wish';

const NOW = Date.UTC(2026, 0, 10, 12, 0);
const HOUR = 3_600_000;

function city(name = '京都', countryCode = 'JPN'): CityRef {
  const geo = makeGeoPoint({ lat: 35.0116, lng: 135.7681, source: 'candidate', approximate: true });
  if (!geo.ok) throw new Error(geo.error.message);
  return makeCityRef({
    name,
    countryCode,
    countryName: '日本',
    centroid: geo.value,
    source: 'gazetteer',
    confidence: 'high',
  });
}

function range(start = NOW, end = NOW + 24 * HOUR) {
  const made = makeTimeRange(start, end);
  if (!made.ok) throw new Error(made.error.message);
  return made.value;
}

function trip(id = 't1', start = NOW, end = NOW + 24 * HOUR) {
  const made = createTrip({
    id,
    title: '京都之行',
    timeRange: range(start, end),
    cityRefs: [city()],
    coverPhotoId: null,
    sourceCandidateId: null,
    origin: 'user',
    createdAt: NOW,
  });
  if (!made.ok) throw new Error(made.error.message);
  return made.value;
}

function photo(id = 'p1', tripId: string | null = null) {
  const geo = makeGeoPoint({ lat: 35.0116, lng: 135.7681, source: 'exif', approximate: false });
  if (!geo.ok) throw new Error(geo.error.message);
  const made = createPhoto({
    id,
    importBatchId: 'batch' as never,
    fileName: `${id}.jpg`,
    mimeType: 'image/jpeg',
    byteSize: 1,
    contentHash: null,
    capturedAt: NOW + HOUR,
    capturedAtSource: 'exif-original',
    captureOffsetMinutes: 540,
    offsetSource: 'exif',
    originalCapturedAt: NOW + HOUR,
    geo: geo.value,
    locationSource: 'exif',
    thumbRef: null,
    origin: 'user',
    importedAt: NOW,
    issues: [],
  });
  if (!made.ok) throw new Error(made.error.message);
  return tripId === null ? made.value : { ...made.value, tripId: tripId as never };
}

describe('trip invariants', () => {
  it('rejects empty or overlong titles', () => {
    const base = {
      id: 't',
      timeRange: range(),
      cityRefs: [],
      coverPhotoId: null,
      sourceCandidateId: null,
      origin: 'user' as const,
      createdAt: NOW,
    };
    expect(createTrip({ ...base, title: '   ' }).ok).toBe(false);
    expect(createTrip({ ...base, title: 'x'.repeat(41) }).ok).toBe(false);
    expect(createTrip({ ...base, title: 'x'.repeat(40) }).ok).toBe(true);
  });

  it('rejects duplicate cities inside one trip', () => {
    const made = createTrip({
      id: 't',
      title: '重复城市',
      timeRange: range(),
      cityRefs: [city(), city()],
      coverPhotoId: null,
      sourceCandidateId: null,
      origin: 'user',
      createdAt: NOW,
    });
    expect(made.ok).toBe(false);
  });

  it('detects overlapping trips and invalidates the set', () => {
    const first = trip('a', NOW, NOW + 10 * HOUR);
    const second = trip('b', NOW + 5 * HOUR, NOW + 20 * HOUR);
    expect(findOverlappingTrip([first], second.timeRange)?.id).toBe('a');
    expect(validateTripSet([first, second]).ok).toBe(false);
    expect(validateTripSet([first, trip('c', NOW + 11 * HOUR, NOW + 20 * HOUR)]).ok).toBe(true);
  });

  it('requires a trip to have photos that fall inside its range', () => {
    const entity = trip();
    expect(validateTripPhotos(entity, []).ok).toBe(false);
    expect(validateTripPhotos(entity, [photo('p1', entity.id)]).ok).toBe(true);
    const outside = { ...photo('p2', entity.id), capturedAt: NOW + 48 * HOUR };
    expect(validateTripPhotos(entity, [outside]).ok).toBe(false);
  });
});

describe('memory invariants', () => {
  it('counts code points and rejects empty or overlong memories', () => {
    const base = { id: 'm', tripId: 't' as never, origin: 'user' as const, now: NOW };
    expect(createMemory({ ...base, text: '   ' }).ok).toBe(false);
    expect(createMemory({ ...base, text: '🐸'.repeat(MEMORY_MAX_CODE_POINTS) }).ok).toBe(true);
    expect(createMemory({ ...base, text: '🐸'.repeat(MEMORY_MAX_CODE_POINTS + 1) }).ok).toBe(false);
  });
});

describe('candidate state machine', () => {
  const build = () => {
    const made = createCandidate({
      id: 'c1',
      importBatchId: 'batch' as never,
      timeRange: range(),
      photoIds: ['p1'],
      cityRefs: [city()],
      locationMissingCount: 0,
      splitReasons: ['manual'],
      confidence: 'low',
      derivedFrom: [],
      origin: 'user',
      createdAt: NOW,
    });
    if (!made.ok) throw new Error(made.error.message);
    return made.value;
  };

  it('only allows pending candidates to be edited', () => {
    const pending = build();
    expect(assertPending(pending, asCandidateId('c1')).ok).toBe(true);
    const ignored = markIgnored(pending, NOW);
    expect(assertPending(ignored, asCandidateId('c1')).ok).toBe(false);
    const restored = markRestored(ignored, NOW);
    expect(restored.ok).toBe(true);
    expect(assertPending(restored.ok ? restored.value : null, asCandidateId('c1')).ok).toBe(true);
  });

  it('rejects candidates without photos or without a split reason', () => {
    const base = {
      id: 'c',
      importBatchId: 'batch' as never,
      timeRange: range(),
      photoIds: ['p1'],
      cityRefs: [],
      locationMissingCount: 0,
      splitReasons: ['manual' as const],
      confidence: 'low' as const,
      derivedFrom: [],
      origin: 'user' as const,
      createdAt: NOW,
    };
    expect(createCandidate({ ...base, photoIds: [] }).ok).toBe(false);
    expect(createCandidate({ ...base, splitReasons: [] }).ok).toBe(false);
  });
});

describe('wish invariants', () => {
  const buildWish = () => {
    const made = createWish({
      id: 'w1',
      cityRef: city('札幌'),
      region: '北海道',
      notes: null,
      origin: 'user',
      source: 'manual',
      now: NOW,
    });
    if (!made.ok) throw new Error(made.error.message);
    return made.value;
  };

  it('marks visited as terminal and stamps visitedAt', () => {
    const wish = buildWish();
    const visited = changeWishStatus(wish, 'visited', NOW + HOUR);
    if (!visited.ok) throw new Error(visited.error.message);
    expect(visited.value.visitedAt).toBe(NOW + HOUR);
    expect(changeWishStatus(visited.value, 'wish', NOW + 2 * HOUR).ok).toBe(false);
  });

  it('keeps visitedAt consistent with the status', () => {
    const wish = buildWish();
    expect(validateWish(wish).ok).toBe(true);
    expect(validateWish({ ...wish, status: 'visited' }).ok).toBe(false);
    expect(validateWish({ ...wish, visitedAt: NOW }).ok).toBe(false);
  });
});

describe('photo invariants', () => {
  it('rejects a location source that disagrees with coordinates', () => {
    const base = {
      id: 'p',
      importBatchId: 'batch' as never,
      fileName: 'a.jpg',
      mimeType: 'image/jpeg',
      byteSize: 1,
      contentHash: null,
      capturedAt: NOW,
      capturedAtSource: 'exif-original' as const,
      captureOffsetMinutes: 0,
      offsetSource: 'exif' as const,
      originalCapturedAt: NOW,
      geo: null,
      locationSource: 'exif' as const,
      thumbRef: null,
      origin: 'user' as const,
      importedAt: NOW,
      issues: [],
    };
    expect(createPhoto(base).ok).toBe(false);
    expect(createPhoto({ ...base, locationSource: 'none' }).ok).toBe(true);
  });
});
