import type { Photo, SplitConfig, Visit } from '../types';
import { haversineKm, nearestCity, placeLabel } from './geo';

export interface VisitBuild {
  visits: Visit[];
  /** photoId -> visitId for located photos. */
  assignments: Record<string, string>;
}

export function buildVisits(tripId: string, photos: Photo[], config: SplitConfig): VisitBuild {
  const located = photos
    .filter((p) => p.lat != null && p.lng != null)
    .slice()
    .sort((a, b) => a.takenAt - b.takenAt);

  const visits: Visit[] = [];
  const assignments: Record<string, string> = {};
  let current: Photo[] = [];
  let centroid: { lat: number; lng: number } | null = null;

  const flush = () => {
    if (!current.length) return;
    const first = current[0];
    const last = current[current.length - 1];
    const lat = current.reduce((s, p) => s + (p.lat ?? 0), 0) / current.length;
    const lng = current.reduce((s, p) => s + (p.lng ?? 0), 0) / current.length;
    const hit = nearestCity(lat, lng);
    const label = placeLabel(lat, lng, first.placeLabel);
    const sameName = visits.filter((v) => v.name === label).length;
    const visit: Visit = {
      id: `${tripId}-v${visits.length + 1}`,
      tripId,
      name: sameName ? `${label} · ${sameName + 1}` : label,
      city: hit?.city ?? label,
      country: hit?.country ?? '—',
      startAt: first.takenAt,
      endAt: last.takenAt,
      lat,
      lng,
      photoCount: current.length,
    };
    visits.push(visit);
    for (const p of current) assignments[p.id] = visit.id;
    current = [];
    centroid = null;
  };

  for (const photo of located) {
    if (!current.length) {
      current = [photo];
      centroid = { lat: photo.lat!, lng: photo.lng! };
      continue;
    }
    const prev = current[current.length - 1];
    const gapHours = (photo.takenAt - prev.takenAt) / 3_600_000;
    const dist = centroid
      ? haversineKm(centroid.lat, centroid.lng, photo.lat!, photo.lng!)
      : 0;
    const labelChanged =
      placeLabel(prev.lat!, prev.lng!, prev.placeLabel) !== placeLabel(photo.lat!, photo.lng!, photo.placeLabel);

    if (gapHours > config.visitGapHours || dist > config.visitRadiusKm || labelChanged) {
      flush();
      current = [photo];
      centroid = { lat: photo.lat!, lng: photo.lng! };
    } else {
      current.push(photo);
      centroid = {
        lat: (centroid!.lat * (current.length - 1) + photo.lat!) / current.length,
        lng: (centroid!.lng * (current.length - 1) + photo.lng!) / current.length,
      };
    }
  }
  flush();
  return { visits, assignments };
}

export function cityNamesOf(photos: Photo[]): string[] {
  const names: string[] = [];
  for (const p of photos) {
    if (p.lat == null || p.lng == null) continue;
    const hit = nearestCity(p.lat, p.lng);
    const name = hit?.city ?? p.placeLabel;
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

export function tripTitle(startAt: number, cities: string[]): string {
  const year = new Date(startAt).getFullYear();
  return `${year} ${cities.slice(0, 3).join(' · ')}`;
}
