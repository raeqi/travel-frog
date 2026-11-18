import type { CityRef } from '../../domain/city/city-ref';
import { makeCityRef, normalizeCityName } from '../../domain/city/city-ref';
import { haversineKm, makeGeoPoint, type GeoPoint } from '../../domain/geo/geo-point';
import type { CityResolver } from '../../domain/ports';
import { CITY_TABLE, type CitySeed } from './city-table';

const MAX_RESOLVE_KM = 80;

function toRef(seed: CitySeed): CityRef {
  const centroid = makeGeoPoint({
    lat: seed.lat,
    lng: seed.lng,
    source: 'candidate',
    approximate: true,
  });
  return makeCityRef({
    name: seed.name,
    countryCode: seed.countryCode,
    countryName: seed.countryName,
    centroid: centroid.ok ? centroid.value : null,
    source: 'gazetteer',
    confidence: 'high',
  });
}

export class GazetteerCityResolver implements CityResolver {
  private readonly entries: readonly { seed: CitySeed; ref: CityRef }[];

  constructor(table: readonly CitySeed[] = CITY_TABLE) {
    this.entries = table.map((seed) => ({ seed, ref: toRef(seed) }));
  }

  resolve(geo: GeoPoint): CityRef | null {
    let best: { ref: CityRef; distance: number } | null = null;
    for (const entry of this.entries) {
      const distance = haversineKm(geo, entry.seed);
      if (!best || distance < best.distance) best = { ref: entry.ref, distance };
    }
    if (!best || best.distance > MAX_RESOLVE_KM) return null;
    return best.ref;
  }

  resolveByName(name: string, countryCode?: string): CityRef | null {
    const target = normalizeCityName(name);
    if (target.length === 0) return null;
    const matches = this.entries.filter((entry) => normalizeCityName(entry.seed.name) === target);
    if (matches.length === 0) return null;
    if (countryCode) {
      const scoped = matches.find((entry) => entry.seed.countryCode === countryCode.toUpperCase());
      if (scoped) return scoped.ref;
    }
    return matches[0]?.ref ?? null;
  }

  suggest(query: string, limit: number): CityRef[] {
    const target = normalizeCityName(query);
    if (target.length === 0) return [];
    const scored: { ref: CityRef; score: number }[] = [];
    for (const entry of this.entries) {
      const name = normalizeCityName(entry.seed.name);
      const country = normalizeCityName(entry.seed.countryName);
      let score = -1;
      if (name === target) score = 0;
      else if (name.startsWith(target)) score = 1;
      else if (name.includes(target)) score = 2;
      else if (country.includes(target)) score = 3;
      if (score >= 0) scored.push({ ref: entry.ref, score });
    }
    return scored
      .sort((a, b) => a.score - b.score || a.ref.name.localeCompare(b.ref.name, 'zh-CN'))
      .slice(0, limit)
      .map((item) => item.ref);
  }
}
