import { describe, expect, it } from 'vitest';
import type { Candidate } from '../candidate/candidate';
import { createCandidate, mergeCandidateRecords, splitCandidateRecord } from '../candidate/candidate';
import { makeCityRef, type CityRef } from '../city/city-ref';
import { asImportBatchId } from '../common/ids';
import { DAY_MS, startOfLocalDay, type TimeRange } from '../common/time';
import { makeGeoPoint, haversineKm, type GeoPoint } from '../geo/geo-point';
import { createPhoto, type Photo } from '../photo/photo';
import { DEFAULT_SPLIT_CONFIG, splitPhotosIntoTrips, type SplitConfig } from './split-trips';

const CONFIG: SplitConfig = { ...DEFAULT_SPLIT_CONFIG };
const at = (y: number, m: number, d: number, h = 10, min = 0) => Date.UTC(y, m - 1, d, h, min);
const NOW = at(2026, 1, 1);

const beijing = { lat: 39.9042, lng: 116.4074 };
const tokyo = { lat: 35.6762, lng: 139.6503 };
const kyoto = { lat: 35.0116, lng: 135.7681 };
const osaka = { lat: 34.6937, lng: 135.5023 };

const CITIES: { name: string; countryCode: string; countryName: string; lat: number; lng: number }[] = [
  { name: '京都', countryCode: 'JPN', countryName: '日本', ...kyoto },
  { name: '大阪', countryCode: 'JPN', countryName: '日本', ...osaka },
  { name: '北京', countryCode: 'CHN', countryName: '中国', ...beijing },
  { name: '东京', countryCode: 'JPN', countryName: '日本', ...tokyo },
];

function cityRef(name: string): CityRef {
  const seed = CITIES.find((city) => city.name === name);
  if (!seed) throw new Error(`unknown city ${name}`);
  const centroid = makeGeoPoint({ lat: seed.lat, lng: seed.lng, source: 'candidate', approximate: true });
  if (!centroid.ok) throw new Error(centroid.error.message);
  return makeCityRef({
    name: seed.name,
    countryCode: seed.countryCode,
    countryName: seed.countryName,
    centroid: centroid.value,
    source: 'gazetteer',
    confidence: 'high',
  });
}

function resolveCity(geo: GeoPoint): CityRef | null {
  let best: { name: string; distance: number } | null = null;
  for (const seed of CITIES) {
    const distance = haversineKm(geo, seed);
    if (!best || distance < best.distance) best = { name: seed.name, distance };
  }
  return best ? cityRef(best.name) : null;
}

function photo(id: string, capturedAt: number, lat?: number, lng?: number): Photo {
  const geo =
    lat === undefined || lng === undefined
      ? null
      : makeGeoPoint({ lat, lng, source: 'exif', approximate: false });
  if (geo && !geo.ok) throw new Error(geo.error.message);
  const created = createPhoto({
    id,
    importBatchId: asImportBatchId('batch-test'),
    fileName: `${id}.jpg`,
    mimeType: 'image/jpeg',
    byteSize: 1024,
    contentHash: `hash-${id}`,
    capturedAt,
    capturedAtSource: 'exif-original',
    captureOffsetMinutes: null,
    offsetSource: 'device',
    originalCapturedAt: capturedAt,
    geo: geo?.value ?? null,
    locationSource: geo ? 'exif' : 'none',
    thumbRef: null,
    origin: 'user',
    importedAt: NOW,
    issues: [],
  });
  if (!created.ok) throw new Error(created.error.message);
  return created.value;
}

function addDays(atTime: number, days: number): number {
  return atTime + days * DAY_MS;
}

describe('splitPhotosIntoTrips', () => {
  const run = (photos: readonly Photo[], config: SplitConfig = CONFIG) => {
    const outcome = splitPhotosIntoTrips({
      photos,
      config,
      existingTrips: [],
      defaultOffsetMinutes: 0,
      now: NOW,
      resolveCity,
    });
    if (!outcome.ok) throw new Error(outcome.error.message);
    return outcome.value;
  };

  it('splits on a long time gap', () => {
    const outcome = run([
      photo('a', at(2025, 5, 2, 10), beijing.lat, beijing.lng),
      photo('b', at(2025, 5, 2, 18), beijing.lat, beijing.lng),
      photo('c', at(2025, 5, 5, 10), beijing.lat, beijing.lng),
    ]);
    const sets = outcome.candidates.map((candidate) => {
      return candidate.photoIds;
    });
    expect(sets).toEqual([
      ['a', 'b'],
      ['c'],
    ]);
  });

  it('keeps a trip together across a normal night', () => {
    const outcome = run([
      photo('a', at(2025, 5, 2, 9), kyoto.lat, kyoto.lng),
      photo('b', at(2025, 5, 2, 20), kyoto.lat, kyoto.lng),
      photo('c', at(2025, 5, 3, 9), kyoto.lat, kyoto.lng),
    ]);
    expect(outcome.candidates).toHaveLength(1);
    expect(outcome.candidates[0]?.photoIds).toEqual(['a', 'b', 'c']);
  });

  it('splits far-apart places when enough time has passed', () => {
    const outcome = run(
      [
        photo('a', at(2025, 5, 1, 9), beijing.lat, beijing.lng),
        photo('b', at(2025, 5, 1, 20), tokyo.lat, tokyo.lng),
      ],
      { ...CONFIG, farPlaceHours: 8 },
    );
    expect(outcome.candidates).toHaveLength(2);
  });

  it('does not split a same-day flight (fast travel)', () => {
    const outcome = run(
      [
        photo('a', at(2025, 5, 1, 9), beijing.lat, beijing.lng),
        photo('b', at(2025, 5, 1, 13), tokyo.lat, tokyo.lng),
      ],
      { ...CONFIG, farPlaceHours: 8 },
    );
    expect(outcome.candidates).toHaveLength(1);
  });

  it('cuts trips longer than maxTripDays', () => {
    const photos = [
      photo('a', at(2025, 5, 1, 9), kyoto.lat, kyoto.lng),
      photo('b', at(2025, 5, 5, 9), kyoto.lat, kyoto.lng),
      photo('c', at(2025, 5, 12, 9), kyoto.lat, kyoto.lng),
    ];
    const outcome = run(photos, { ...CONFIG, maxTripDays: 7, maxGapHours: 192 });
    expect(outcome.candidates).toHaveLength(2);
    expect(outcome.candidates[0]?.photoIds).toEqual(['a', 'b']);
    expect(outcome.candidates[1]?.photoIds).toEqual(['c']);
  });

  it('lets photos without GPS follow the time rule', () => {
    const outcome = run([
      photo('a', at(2025, 5, 2, 10), kyoto.lat, kyoto.lng),
      photo('b', at(2025, 5, 2, 11)),
      photo('c', at(2025, 5, 9, 11)),
    ]);
    expect(outcome.candidates.map((candidate) => [...candidate.photoIds])).toEqual([
      ['a', 'b'],
      ['c'],
    ]);
  });

  it('excludes future-dated and assigned photos with an explicit reason', () => {
    const future = photo('future', addDays(NOW, 3), kyoto.lat, kyoto.lng);
    const assigned = { ...photo('assigned', at(2025, 5, 2, 10)), tripId: 'trip-x' as never };
    const outcome = run([photo('a', at(2025, 5, 2, 10), kyoto.lat, kyoto.lng), future, assigned]);
    expect(outcome.candidates).toHaveLength(1);
    expect(outcome.excluded.map((item) => item.reason)).toEqual(['future-clock', 'assigned']);
  });
});

function candidateOf(id: string, members: readonly Photo[], cityNames: readonly string[]): Candidate {
  const sorted = members.slice().sort((a, b) => a.capturedAt - b.capturedAt);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) throw new Error('candidate needs photos');
  const timeRange: TimeRange = {
    start: startOfLocalDay(first.capturedAt, 0),
    end: startOfLocalDay(last.capturedAt, 0) + DAY_MS,
  };
  const created = createCandidate({
    id,
    importBatchId: asImportBatchId('batch-test'),
    timeRange,
    photoIds: sorted.map((item) => item.id),
    cityRefs: cityNames.map(cityRef),
    locationMissingCount: sorted.filter((item) => item.geo === null).length,
    splitReasons: ['manual'],
    confidence: 'high',
    derivedFrom: [],
    origin: 'user',
    createdAt: first.capturedAt,
  });
  if (!created.ok) throw new Error(created.error.message);
  return created.value;
}

describe('mergeCandidateRecords', () => {
  it('unions dates, photos and city names without duplicates', () => {
    const a = photo('a', at(2025, 5, 2, 10), kyoto.lat, kyoto.lng);
    const b = photo('b', at(2025, 5, 3, 10), kyoto.lat, kyoto.lng);
    const c = photo('c', at(2025, 5, 4, 10), osaka.lat, osaka.lng);
    const d = photo('d', at(2025, 5, 5, 10));
    const first = candidateOf('a-cand', [a, b], ['京都']);
    const second = candidateOf('b-cand', [c, d], ['大阪']);
    const merged = mergeCandidateRecords({
      a: first,
      b: second,
      photos: [a, b, c, d],
      newId: 'merged',
      resolveCity,
      defaultOffsetMinutes: 0,
      now: NOW,
    });
    if (!merged.ok) throw new Error(merged.error.message);
    expect(merged.value.timeRange.start).toBe(startOfLocalDay(a.capturedAt, 0));
    expect(merged.value.timeRange.end).toBe(startOfLocalDay(d.capturedAt, 0) + DAY_MS);
    expect(merged.value.photoIds).toEqual(['a', 'b', 'c', 'd']);
    expect(merged.value.cityRefs.map((city) => city.name)).toEqual(['京都', '大阪']);
    expect(merged.value.locationMissingCount).toBe(1);
    expect(merged.value.derivedFrom).toEqual([first.id, second.id]);
  });
});

describe('splitCandidateRecord', () => {
  const build = () => {
    const a = photo('a', at(2025, 5, 2, 10), kyoto.lat, kyoto.lng);
    const b = photo('b', at(2025, 5, 3, 10), kyoto.lat, kyoto.lng);
    const c = photo('c', at(2025, 5, 3, 20), osaka.lat, osaka.lng);
    const d = photo('d', at(2025, 5, 4, 10), osaka.lat, osaka.lng);
    return { originals: candidateOf('c1', [a, b, c, d], ['京都', '大阪']), photos: [a, b, c, d] };
  };

  it('splits photos at a day boundary in chronological order', () => {
    const { originals, photos } = build();
    const parts = splitCandidateRecord({
      candidate: originals,
      at: at(2025, 5, 3, 0),
      photos,
      ids: ['left', 'right'],
      resolveCity,
      defaultOffsetMinutes: 0,
      now: NOW,
    });
    if (!parts.ok) throw new Error(parts.error.message);
    const [first, second] = parts.value;
    expect(first.photoIds).toEqual(['a']);
    expect(second.photoIds).toEqual(['b', 'c', 'd']);
    expect(first.cityRefs.map((city) => city.name)).toEqual(['京都']);
    expect(second.cityRefs.map((city) => city.name)).toEqual(['京都', '大阪']);
    expect(new Set([...first.photoIds, ...second.photoIds]).size).toBe(originals.photoIds.length);
    expect(first.timeRange.end).toBeLessThanOrEqual(second.timeRange.start);
  });

  it('refuses a split that would leave one side empty', () => {
    const { originals, photos } = build();
    const before = splitCandidateRecord({
      candidate: originals,
      at: at(2025, 5, 1, 0),
      photos,
      ids: ['left', 'right'],
      resolveCity,
      defaultOffsetMinutes: 0,
      now: NOW,
    });
    const after = splitCandidateRecord({
      candidate: originals,
      at: at(2025, 5, 9, 0),
      photos,
      ids: ['left', 'right'],
      resolveCity,
      defaultOffsetMinutes: 0,
      now: NOW,
    });
    expect(before.ok).toBe(false);
    expect(after.ok).toBe(false);
  });
});
