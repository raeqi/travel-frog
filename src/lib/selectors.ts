import type { AppData, Photo, Trip } from '../types';
import { nearestCity } from './geo';

export function photosOfTrip(data: AppData, tripId: string): Photo[] {
  return Object.values(data.photos)
    .filter((p) => p.tripId === tripId)
    .sort((a, b) => a.takenAt - b.takenAt);
}

export function coverOfTrip(data: AppData, tripId: string): string | undefined {
  return photosOfTrip(data, tripId).find((p) => p.thumb)?.thumb;
}

export function missingPhotosOfTrip(data: AppData, tripId: string): Photo[] {
  return photosOfTrip(data, tripId).filter((p) => (p.lat == null || p.lng == null) && !p.ignored);
}

export function latestTrip(data: AppData): Trip | undefined {
  return data.trips.slice().sort((a, b) => b.endAt - a.endAt)[0];
}

export interface VisitedCity {
  name: string;
  country: string;
  year: number;
  photos: number;
  manual?: boolean;
}

export function visitedCities(data: AppData): VisitedCity[] {
  const map = new Map<string, VisitedCity>();
  for (const trip of data.trips) {
    const year = new Date(trip.endAt).getFullYear();
    const photoCounts = new Map<string, number>();
    const visitCity = new Map<string, string>();
    const cityMeta = new Map<string, { name: string; country: string }>();
    for (const visit of trip.visits) {
      if (visit.lat == null || visit.lng == null) continue;
      const hit = nearestCity(visit.lat, visit.lng);
      const name = hit?.city ?? visit.city;
      const country = hit?.country ?? visit.country;
      const key = `${name}|${country}`;
      visitCity.set(visit.id, key);
      cityMeta.set(key, { name, country });
      if (!photoCounts.has(key)) photoCounts.set(key, 0);
    }
    for (const p of photosOfTrip(data, trip.id)) {
      const key = p.visitId ? visitCity.get(p.visitId) : undefined;
      if (key) photoCounts.set(key, (photoCounts.get(key) ?? 0) + 1);
    }
    for (const [key, photoCount] of photoCounts) {
      const meta = cityMeta.get(key) as { name: string; country: string };
      const found = map.get(key);
      if (found) {
        found.photos += photoCount;
        found.year = Math.max(found.year, year);
      } else {
        map.set(key, { name: meta.name, country: meta.country, year, photos: photoCount });
      }
    }
  }
  for (const m of data.manualVisited) {
    const key = `${m.name}|${m.country}`;
    if (!map.has(key)) map.set(key, { name: m.name, country: m.country, year: m.year, photos: 0, manual: true });
  }
  return Array.from(map.values()).sort((a, b) => b.year - a.year || a.name.localeCompare(b.name, 'zh'));
}

export function tripLabel(trip: Trip): string {
  return trip.cityNames.length ? trip.cityNames.join(' · ') : '未识别地点';
}
