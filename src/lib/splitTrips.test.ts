import { describe, expect, it } from 'vitest';
import type { Candidate, Photo, SplitConfig } from '../types';
import { DEFAULT_CONFIG, mergeCandidates, splitCandidate, splitPhotosIntoTrips } from './splitTrips';

const CONFIG: SplitConfig = { ...DEFAULT_CONFIG };
const at = (y: number, m: number, d: number, h = 10, min = 0) => new Date(y, m - 1, d, h, min).getTime();

const beijing = { lat: 39.9042, lng: 116.4074 };
const tokyo = { lat: 35.6762, lng: 139.6503 };

const photo = (id: string, takenAt: number, lat?: number, lng?: number): Photo => ({
  id,
  name: `${id}.jpg`,
  takenAt,
  lat,
  lng,
  locationSource: lat == null ? 'none' : 'exif',
});

describe('splitPhotosIntoTrips', () => {
  it('splits on a long time gap', () => {
    const groups = splitPhotosIntoTrips(
      [
        photo('a', at(2025, 5, 2, 10), beijing.lat, beijing.lng),
        photo('b', at(2025, 5, 2, 18), beijing.lat, beijing.lng),
        photo('c', at(2025, 8, 2, 10), beijing.lat, beijing.lng),
      ],
      CONFIG,
    );
    expect(groups.map((g) => g.map((p) => p.id))).toEqual([['a', 'b'], ['c']]);
  });

  it('keeps a trip together across a normal night', () => {
    const groups = splitPhotosIntoTrips(
      [
        photo('a', at(2025, 5, 2, 9), 35.0116, 135.7681),
        photo('b', at(2025, 5, 2, 20), 35.0116, 135.7681),
        photo('c', at(2025, 5, 3, 9), 35.0116, 135.7681),
      ],
      CONFIG,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(3);
  });

  it('splits far-apart places when enough time has passed', () => {
    const groups = splitPhotosIntoTrips(
      [
        photo('a', at(2025, 5, 1, 9), beijing.lat, beijing.lng),
        photo('b', at(2025, 5, 1, 20), tokyo.lat, tokyo.lng),
      ],
      { ...CONFIG, farPlaceHours: 8 },
    );
    expect(groups).toHaveLength(2);
  });

  it('does not split a same-day flight (fast travel)', () => {
    const groups = splitPhotosIntoTrips(
      [
        photo('a', at(2025, 5, 1, 9), beijing.lat, beijing.lng),
        photo('b', at(2025, 5, 1, 13), tokyo.lat, tokyo.lng),
      ],
      { ...CONFIG, farPlaceHours: 8 },
    );
    expect(groups).toHaveLength(1);
  });

  it('cuts trips longer than maxTripDays', () => {
    const photos = [
      photo('a', at(2025, 5, 1, 9), 35.0116, 135.7681),
      photo('b', at(2025, 5, 5, 9), 35.0116, 135.7681),
      photo('c', at(2025, 5, 12, 9), 35.0116, 135.7681),
    ];
    const groups = splitPhotosIntoTrips(photos, { ...CONFIG, maxTripDays: 7, maxGapHours: 192 });
    expect(groups).toHaveLength(2);
    expect(groups[0].map((p) => p.id)).toEqual(['a', 'b']);
    expect(groups[1].map((p) => p.id)).toEqual(['c']);
  });

  it('lets photos without GPS follow the time rule', () => {
    const groups = splitPhotosIntoTrips(
      [
        photo('a', at(2025, 5, 2, 10), 35.0116, 135.7681),
        photo('b', at(2025, 5, 2, 11)),
        photo('c', at(2025, 5, 9, 11)),
      ],
      CONFIG,
    );
    expect(groups.map((g) => g.map((p) => p.id))).toEqual([['a', 'b'], ['c']]);
  });
});

const candidate = (id: string, ids: string[], start: number, end: number, cities: string[]): Candidate => ({
  id,
  startAt: start,
  endAt: end,
  photoIds: ids,
  cityNames: cities,
  locationMissing: 0,
  status: 'pending',
});

describe('mergeCandidates', () => {
  it('unions dates, photos and city names without duplicates', () => {
    const photos: Record<string, Photo> = {
      a: photo('a', at(2025, 5, 2, 10), 35.0116, 135.7681),
      b: photo('b', at(2025, 5, 3, 10), 35.0116, 135.7681),
      c: photo('c', at(2025, 5, 4, 10), 34.6937, 135.5023),
      d: photo('d', at(2025, 5, 5, 10)),
    };
    const a = candidate('a-cand', ['a', 'b'], photos.a.takenAt, photos.b.takenAt, ['京都']);
    const b = candidate('b-cand', ['c', 'd'], photos.c.takenAt, photos.d.takenAt, ['大阪']);
    const merged = mergeCandidates(a, b, photos);
    expect(merged.startAt).toBe(photos.a.takenAt);
    expect(merged.endAt).toBe(photos.d.takenAt);
    expect(merged.photoIds).toEqual(['a', 'b', 'c', 'd']);
    expect(merged.cityNames).toEqual(['京都', '大阪']);
    expect(merged.locationMissing).toBe(1);
  });
});

describe('splitCandidate', () => {
  it('splits photos at a day boundary in chronological order', () => {
    const photos: Record<string, Photo> = {
      a: photo('a', at(2025, 5, 2, 10), 35.0116, 135.7681),
      b: photo('b', at(2025, 5, 3, 10), 35.0116, 135.7681),
      c: photo('c', at(2025, 5, 3, 20), 34.6937, 135.5023),
      d: photo('d', at(2025, 5, 4, 10), 34.6937, 135.5023),
    };
    const original = candidate('c1', ['a', 'b', 'c', 'd'], photos.a.takenAt, photos.d.takenAt, ['京都', '大阪']);
    const parts = splitCandidate(original, at(2025, 5, 3, 0), photos);
    expect(parts).not.toBeNull();
    const [first, second] = parts!;
    expect(first.photoIds).toEqual(['a']);
    expect(second.photoIds).toEqual(['b', 'c', 'd']);
    expect(first.cityNames).toEqual(['京都']);
    expect(second.cityNames).toEqual(['京都', '大阪']);
    expect(new Set([...first.photoIds, ...second.photoIds]).size).toBe(original.photoIds.length);
  });

  it('refuses a split that would leave one side empty', () => {
    const photos: Record<string, Photo> = {
      a: photo('a', at(2025, 5, 2, 10), 35.0116, 135.7681),
      b: photo('b', at(2025, 5, 3, 10), 35.0116, 135.7681),
    };
    const original = candidate('c1', ['a', 'b'], photos.a.takenAt, photos.b.takenAt, ['京都']);
    expect(splitCandidate(original, at(2025, 5, 1, 0), photos)).toBeNull();
    expect(splitCandidate(original, at(2025, 5, 9, 0), photos)).toBeNull();
  });
});
