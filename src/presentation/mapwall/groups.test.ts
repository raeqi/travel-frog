import { describe, expect, it } from 'vitest';
import { groupPoiData, poiTotal, type PoiGroupInput } from './groups';
import type { WallWish } from './model';

const NAMES: Record<string, string> = {
  'JPN:京都': '京都',
  'JPN:大阪': '大阪',
  'JPN:宇治': '宇治',
  'ISL:雷克雅未克': '雷克雅未克',
};

function wish(id: string, status: WallWish['status'], cityKey = 'JPN:京都'): WallWish {
  return {
    id,
    cityKey,
    name: NAMES[cityKey] ?? cityKey,
    region: null,
    countryName: '日本',
    status,
    note: status === 'pending' ? null : '一句留言',
    from: null,
    lat: 0,
    lng: 0,
    createdAt: 1,
  };
}

function input(overrides: Partial<PoiGroupInput> = {}): PoiGroupInput {
  return {
    photos: [
      { id: 'p1', cityKey: 'JPN:京都', tripId: 't2025' },
      { id: 'p2', cityKey: 'JPN:京都', tripId: 't2025' },
      { id: 'p3', cityKey: 'JPN:大阪', tripId: 't2025' },
      { id: 'p4', cityKey: 'JPN:宇治', tripId: 't2024' },
      { id: 'p5', cityKey: 'JPN:京都', tripId: 't2024' },
    ],
    trips: [
      { id: 't2025', year: 2025 },
      { id: 't2024', year: 2024 },
    ],
    cityName: (key) => NAMES[key] ?? key,
    wishes: [wish('w1', 'opened'), wish('w2', 'received', 'JPN:大阪'), wish('w3', 'opened', 'ISL:雷克雅未克')],
    ...overrides,
  };
}

describe('groupPoiData', () => {
  it('groups by trip year newest first, then by city with the most photos first', () => {
    const groups = groupPoiData(input());
    expect(groups.years.map((group) => group.year)).toEqual([2025, 2024]);
    expect(groups.years[0]?.rows.map((row) => [row.cityKey, row.count])).toEqual([
      ['JPN:京都', 2],
      ['JPN:大阪', 1],
    ]);
    expect(groups.years[1]?.rows.map((row) => [row.cityKey, row.count])).toEqual([
      ['JPN:京都', 1],
      ['JPN:宇治', 1],
    ]);
  });

  it('keeps the first photo as the row thumbnail and resolves city names', () => {
    const groups = groupPoiData(input());
    const kyoto = groups.years[0]?.rows[0];
    expect(kyoto).toMatchObject({ name: '京都', photoId: 'p1' });
  });

  it('places a city visited in two years into both year groups', () => {
    const groups = groupPoiData(input());
    expect(groups.years.map((group) => group.rows.some((row) => row.cityKey === 'JPN:京都'))).toEqual([
      true,
      true,
    ]);
  });

  it('lists every postcard that is not fulfilled in the "还想去" group', () => {
    const groups = groupPoiData(input());
    expect(groups.wished.map((item) => item.id)).toEqual(['w1', 'w2', 'w3']);
  });

  it('skips photos whose trip is unknown', () => {
    const groups = groupPoiData(
      input({ photos: [{ id: 'orphan', cityKey: 'JPN:京都', tripId: 'missing' }] }),
    );
    expect(groups.years).toEqual([]);
    expect(poiTotal(groups)).toBe(0);
  });

  it('counts city rows, not photos, in the header total', () => {
    // 5 photos collapse into 2 city rows for 2025 and 2 for 2024.
    expect(poiTotal(groupPoiData(input()))).toBe(4);
  });
});
