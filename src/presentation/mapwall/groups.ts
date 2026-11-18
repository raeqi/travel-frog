import type { WallModel, WallWish } from './model';

export interface PoiRow {
  readonly cityKey: string;
  readonly name: string;
  readonly count: number;
  readonly photoId: string;
}

export interface PoiYearGroup {
  readonly year: number;
  readonly rows: readonly PoiRow[];
}

export interface PoiGroups {
  readonly years: readonly PoiYearGroup[];
  readonly wished: readonly WallWish[];
}

export interface PoiGroupPhoto {
  readonly id: string;
  readonly cityKey: string;
  readonly tripId: string;
}

export interface PoiGroupTrip {
  readonly id: string;
  readonly year: number;
}

export interface PoiGroupInput {
  readonly photos: readonly PoiGroupPhoto[];
  readonly trips: readonly PoiGroupTrip[];
  readonly cityName: (cityKey: string) => string;
  readonly wishes: readonly WallWish[];
}

/**
 * Groups the wall's photos by trip year and then by city. A city visited in two
 * different years deliberately appears once in each year. Open postcards live in
 * their own "还想去" group, separate from the travel footprints.
 */
export function groupPoiData(input: PoiGroupInput): PoiGroups {
  const yearById = new Map(input.trips.map((trip) => [trip.id, trip.year] as const));
  const buckets = new Map<number, Map<string, PoiRow>>();

  for (const photo of input.photos) {
    const year = yearById.get(photo.tripId);
    if (year === undefined) continue;
    let cities = buckets.get(year);
    if (!cities) {
      cities = new Map();
      buckets.set(year, cities);
    }
    const existing = cities.get(photo.cityKey);
    if (existing) {
      cities.set(photo.cityKey, { ...existing, count: existing.count + 1 });
    } else {
      cities.set(photo.cityKey, {
        cityKey: photo.cityKey,
        name: input.cityName(photo.cityKey),
        count: 1,
        photoId: photo.id,
      });
    }
  }

  const years = Array.from(buckets.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([year, cities]) => ({
      year,
      rows: Array.from(cities.values()).sort(
        (a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'),
      ),
    }));

  return {
    years,
    wished: input.wishes.filter((wish) => wish.status !== 'fulfilled'),
  };
}

export function groupPoiRows(model: WallModel): PoiGroups {
  return groupPoiData({
    photos: model.photos,
    trips: model.trips,
    cityName: (key) => model.cityByKey.get(key)?.name ?? key,
    wishes: model.wishes,
  });
}

export function poiTotal(groups: PoiGroups): number {
  return groups.years.reduce((total, group) => total + group.rows.length, 0);
}
