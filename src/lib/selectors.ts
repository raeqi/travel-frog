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
    const photos = photosOfTrip(data, trip.id).length;
    const seen = new Set<string>();
    for (const visit of trip.visits) {
      if (visit.lat == null || visit.lng == null) continue;
      const hit = nearestCity(visit.lat, visit.lng);
      const name = hit?.city ?? visit.city;
      const country = hit?.country ?? visit.country;
      const key = `${name}|${country}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const found = map.get(key);
      if (found) {
        found.photos += photos;
        found.year = Math.max(found.year, year);
      } else {
        map.set(key, { name, country, year, photos });
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
