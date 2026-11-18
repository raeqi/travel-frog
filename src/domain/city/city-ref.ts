import type { GeoPoint } from '../geo/geo-point';

export type Confidence = 'high' | 'medium' | 'low';
export type CitySource = 'gazetteer' | 'manual' | 'derived';

/** City-level location reference. Never carries a precise coordinate beyond the centroid. */
export interface CityRef {
  readonly key: string;
  readonly name: string;
  readonly countryCode: string;
  readonly countryName: string;
  readonly centroid: GeoPoint | null;
  readonly source: CitySource;
  readonly confidence: Confidence;
}

export const UNKNOWN_COUNTRY_CODE = 'XXX';

export function normalizeCityName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('zh-CN');
}

export function cityKey(countryCode: string, name: string): string {
  return `${countryCode.toUpperCase()}:${normalizeCityName(name)}`;
}

export function makeCityRef(input: {
  name: string;
  countryCode: string;
  countryName: string;
  centroid: GeoPoint | null;
  source: CitySource;
  confidence: Confidence;
}): CityRef {
  return {
    key: cityKey(input.countryCode, input.name),
    name: input.name.trim(),
    countryCode: input.countryCode.toUpperCase(),
    countryName: input.countryName.trim(),
    centroid: input.centroid,
    source: input.source,
    confidence: input.confidence,
  };
}

export function unknownCity(centroid: GeoPoint | null): CityRef {
  return {
    key: `${UNKNOWN_COUNTRY_CODE}:unknown`,
    name: '未识别地点',
    countryCode: UNKNOWN_COUNTRY_CODE,
    countryName: '未知',
    centroid,
    source: 'derived',
    confidence: 'low',
  };
}

export function dedupeCities(cities: readonly CityRef[]): CityRef[] {
  const seen = new Set<string>();
  const out: CityRef[] = [];
  for (const city of cities) {
    if (seen.has(city.key)) continue;
    seen.add(city.key);
    out.push(city);
  }
  return out;
}
