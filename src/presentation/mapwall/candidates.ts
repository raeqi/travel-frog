import { cityKey } from '../../domain/city/city-ref';

export interface DestinationCandidate {
  readonly city: string;
  /** Canonical city reference key, aligned with `CityRef.key` in the archive. */
  readonly key: string;
  readonly name: string;
  readonly country: string;
  readonly countryCode: string;
  readonly lat: number;
  readonly lng: number;
}

function destination(
  city: string,
  name: string,
  country: string,
  countryCode: string,
  lat: number,
  lng: number,
): DestinationCandidate {
  return { city, key: cityKey(countryCode, name), name, country, countryCode, lat, lng };
}

/**
 * Places the frog can be sent to. Kept independent from the gazetteer so the wall
 * still knows a destination's coordinates when the local city table is incomplete.
 */
export const DEST_CANDIDATES: readonly DestinationCandidate[] = [
  destination('kanazawa', '金泽', '日本', 'JPN', 36.5613, 136.6562),
  destination('seoul', '首尔', '韩国', 'KOR', 37.5665, 126.978),
  destination('hoian', '会安', '越南', 'VNM', 15.8801, 108.338),
  destination('jaipur', '斋浦尔', '印度', 'IND', 26.9124, 75.7873),
  destination('cusco', '库斯科', '秘鲁', 'PER', -13.5319, -71.9675),
  destination('capetown', '开普敦', '南非', 'ZAF', -33.9249, 18.4241),
  destination('nuuk', '努克', '格陵兰', 'GRL', 64.1835, -51.7216),
  destination('portland', '波特兰', '美国', 'USA', 45.5152, -122.6784),
];

export interface DestinationFilter {
  /** City keys that already have a confirmed trip. */
  readonly visitedCityKeys: Iterable<string>;
  /** City keys of postcards whose journey is still open (not yet fulfilled). */
  readonly activeWishCityKeys: Iterable<string>;
}

/**
 * Pending-entrust candidates must be both unvisited and free of an active postcard.
 * Fulfilled postcards already count as visits, so they do not block the list twice.
 */
export function availableDestinations(filter: DestinationFilter): DestinationCandidate[] {
  const blocked = new Set<string>([...filter.visitedCityKeys, ...filter.activeWishCityKeys]);
  return DEST_CANDIDATES.filter((destination) => !blocked.has(destination.key));
}
