import type { ArchiveSnapshot } from '../../application/snapshot';
import type { CityRef } from '../../domain/city/city-ref';
import type { Trip } from '../../domain/trip/trip';
import type { WishStatus } from '../../domain/wish/wish';
import { fnv1a } from './geometry';
import { paletteFor, type PaletteName } from './photoArt';

export interface WallPhoto {
  readonly id: string;
  readonly tripId: string;
  readonly cityKey: string;
  readonly lat: number;
  readonly lng: number;
  readonly capturedAt: number;
  readonly palette: PaletteName;
  readonly thumbRef: string | null;
  readonly origin?: 'user' | 'demo';
  readonly inferred: boolean;
}

export interface WallVisit {
  readonly id: string;
  readonly tripId: string;
  readonly sequence: number;
  readonly cityKey: string;
  readonly name: string;
  readonly countryName: string;
  readonly lat: number;
  readonly lng: number;
  readonly photoIds: readonly string[];
  readonly start: number;
  readonly end: number;
}

export interface WallTrip {
  readonly id: string;
  readonly title: string;
  readonly year: number;
  readonly start: number;
  readonly end: number;
  readonly days: number;
  readonly memory: string | null;
  readonly visits: readonly WallVisit[];
  readonly cityKeys: readonly string[];
  readonly photoIds: readonly string[];
}

export interface WallWish {
  readonly journey?: boolean;
  readonly demo?: boolean;
  readonly updatedAt?: number;
  readonly deliveredAt?: number | null;
  readonly id: string;
  readonly cityKey: string;
  readonly name: string;
  readonly region: string | null;
  readonly countryName: string;
  readonly status: WishStatus;
  readonly note: string | null;
  readonly from: string | null;
  readonly lat: number;
  readonly lng: number;
  readonly createdAt: number;
}

export interface WallCity {
  readonly key: string;
  readonly name: string;
  readonly countryName: string;
  readonly lat: number;
  readonly lng: number;
  readonly photoIds: readonly string[];
  readonly tripIds: readonly string[];
  readonly year: number;
  readonly long: boolean;
}

export interface WallModel {
  readonly trips: readonly WallTrip[];
  readonly photos: readonly WallPhoto[];
  readonly visits: readonly WallVisit[];
  readonly cities: readonly WallCity[];
  readonly wishes: readonly WallWish[];
  readonly noGpsCount: number;
  readonly photoById: ReadonlyMap<string, WallPhoto>;
  readonly tripById: ReadonlyMap<string, WallTrip>;
  readonly cityByKey: ReadonlyMap<string, WallCity>;
  readonly wishById: ReadonlyMap<string, WallWish>;
}

const DAY_MS = 86_400_000;

export function wallModelIsEmpty(model: WallModel): boolean {
  return model.trips.length === 0 && model.photos.length === 0 && model.wishes.length === 0;
}

function isFiniteCoordinate(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
}

function nearestRef(refs: readonly CityRef[], lat: number, lng: number): CityRef | null {
  let best: CityRef | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const ref of refs) {
    const centroid = ref.centroid;
    if (!centroid) continue;
    const dx = centroid.lng - lng;
    const dy = centroid.lat - lat;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = ref;
    }
  }
  return best;
}

export function paletteOf(photoId: string): PaletteName {
  return paletteFor(fnv1a(`photo:${photoId}`));
}

export function imageSeed(photoId: string): number {
  return fnv1a(`art:${photoId}`);
}

export function buildWallModel(snapshot: ArchiveSnapshot, homeCityKey: string | null = null): WallModel {
  const isHome = (key: string) => homeCityKey !== null && key === homeCityKey;
  const tripById: Map<string, Trip> = new Map(snapshot.trips.map((trip) => [trip.id, trip] as const));
  const visitById = new Map(snapshot.visits.map((visit) => [visit.id, visit] as const));
  const memoryByTrip = new Map(snapshot.memories.map((memory) => [memory.tripId, memory.text] as const));

  const refs = new Map<string, CityRef>();
  for (const trip of snapshot.trips) {
    for (const ref of trip.cityRefs) {
      if (!isHome(ref.key)) refs.set(ref.key, ref);
    }
  }
  for (const visit of snapshot.visits) {
    if (!isHome(visit.cityRef.key)) refs.set(visit.cityRef.key, visit.cityRef);
  }
  for (const wish of snapshot.wishes) {
    if (!isHome(wish.cityRef.key)) refs.set(wish.cityRef.key, wish.cityRef);
  }
  const candidateRefs = Array.from(refs.values()).filter((ref) => ref.centroid !== null);

  const visitsByTrip = new Map<string, WallVisit[]>();
  const photoIdsByVisit = new Map<string, string[]>();
  for (const photo of snapshot.photos) {
    if (!photo.visitId || photo.tripId === null || photo.geo === null || photo.ignored) continue;
    const list = photoIdsByVisit.get(photo.visitId) ?? [];
    list.push(photo.id);
    photoIdsByVisit.set(photo.visitId, list);
  }

  const wallVisits: WallVisit[] = [];
  for (const visit of snapshot.visits) {
    if (!tripById.has(visit.tripId)) continue;
    if (isHome(visit.cityRef.key)) continue;
    const lat = visit.geo?.lat ?? visit.cityRef.centroid?.lat;
    const lng = visit.geo?.lng ?? visit.cityRef.centroid?.lng;
    if (lat === undefined || lng === undefined || !isFiniteCoordinate(lat, lng)) continue;
    const wallVisit: WallVisit = {
      id: visit.id,
      tripId: visit.tripId,
      sequence: visit.sequence,
      cityKey: visit.cityRef.key,
      name: visit.displayName || visit.cityRef.name,
      countryName: visit.cityRef.countryName,
      lat,
      lng,
      photoIds: photoIdsByVisit.get(visit.id) ?? [],
      start: visit.timeRange.start,
      end: visit.timeRange.end,
    };
    wallVisits.push(wallVisit);
    const list = visitsByTrip.get(visit.tripId) ?? [];
    list.push(wallVisit);
    visitsByTrip.set(visit.tripId, list);
  }
  for (const list of visitsByTrip.values()) list.sort((a, b) => a.sequence - b.sequence);

  const wallPhotos: WallPhoto[] = [];
  let noGpsCount = 0;
  for (const photo of snapshot.photos) {
    if (photo.tripId === null || photo.ignored) continue;
    if (photo.geo === null) {
      noGpsCount += 1;
      continue;
    }
    const visit = photo.visitId ? visitById.get(photo.visitId) : undefined;
    const nearest = refs.size > 0 ? nearestRef(candidateRefs, photo.geo.lat, photo.geo.lng) : null;
    const cityRef = visit?.cityRef ?? nearest ?? tripById.get(photo.tripId)?.cityRefs[0] ?? null;
    const cityKey = cityRef?.key ?? `photo:${photo.id}`;
    if (isHome(cityKey)) continue;
    wallPhotos.push({
      id: photo.id,
      tripId: photo.tripId,
      cityKey,
      lat: photo.geo.lat,
      lng: photo.geo.lng,
      capturedAt: photo.capturedAt,
      palette: paletteOf(photo.id),
      thumbRef: photo.thumbRef,
      origin: photo.origin,
      inferred: photo.locationSource === 'candidate' || photo.geo.approximate,
    });
  }

  const wallTrips: WallTrip[] = snapshot.trips
    .map((trip) => {
      const visits = visitsByTrip.get(trip.id) ?? [];
      const photoIds = wallPhotos.filter((photo) => photo.tripId === trip.id).map((photo) => photo.id);
      return {
        id: trip.id,
        title: trip.title,
        year: new Date(trip.timeRange.end - 1).getUTCFullYear(),
        start: trip.timeRange.start,
        end: trip.timeRange.end,
        days: Math.max(1, Math.round((trip.timeRange.end - trip.timeRange.start) / DAY_MS)),
        memory: memoryByTrip.get(trip.id) ?? null,
        visits,
        cityKeys: Array.from(new Set(trip.cityRefs.map((ref) => ref.key).filter((key) => !isHome(key)))),
        photoIds,
      };
    })
    .filter((trip) => trip.visits.length > 0 || trip.cityKeys.length > 0 || trip.photoIds.length > 0);

  const cityMap = new Map<string, { ref: CityRef; photos: WallPhoto[]; tripIds: Set<string> }>();
  for (const photo of wallPhotos) {
    const known = cityMap.get(photo.cityKey);
    if (known) {
      known.photos.push(photo);
      known.tripIds.add(photo.tripId);
      continue;
    }
    const ref = refs.get(photo.cityKey);
    cityMap.set(photo.cityKey, {
      ref:
        ref ??
        {
          key: photo.cityKey,
          name: refs.get(photo.cityKey)?.name ?? cityNameFallback(snapshot, photo.tripId),
          countryCode: 'XXX',
          countryName: '未知',
          centroid: { lat: photo.lat, lng: photo.lng, accuracyM: null, source: 'candidate', approximate: true },
          source: 'derived',
          confidence: 'low',
        },
      photos: [photo],
      tripIds: new Set([photo.tripId]),
    });
  }

  const cities: WallCity[] = [];
  for (const [key, entry] of cityMap) {
    const lat = entry.photos.reduce((sum, photo) => sum + photo.lat, 0) / entry.photos.length;
    const lng = entry.photos.reduce((sum, photo) => sum + photo.lng, 0) / entry.photos.length;
    let year = 0;
    for (const tripId of entry.tripIds) {
      const trip = tripById.get(tripId);
      if (trip) year = Math.max(year, new Date(trip.timeRange.end - 1).getUTCFullYear());
    }
    cities.push({
      key,
      name: entry.ref.name,
      countryName: entry.ref.countryName,
      lat,
      lng,
      photoIds: entry.photos.map((photo) => photo.id),
      tripIds: Array.from(entry.tripIds),
      year,
      long: entry.ref.name.length > 9,
    });
  }
  cities.sort((a, b) => b.photoIds.length - a.photoIds.length || a.name.localeCompare(b.name, 'zh-CN'));

  const wishes: WallWish[] = [];
  for (const wish of snapshot.wishes) {
    if (wish.status === 'declined') continue;
    if (isHome(wish.cityRef.key)) continue;
    const centroid = wish.cityRef.centroid;
    if (!centroid) continue;
    wishes.push({
      journey: wish.delivery === 'journey',
      demo: wish.origin === 'demo',
      id: wish.id,
      cityKey: wish.cityRef.key,
      name: wish.cityRef.name,
      region: wish.region,
      countryName: wish.cityRef.countryName,
      status: wish.status,
      note: wish.note,
      from: wish.from,
      lat: centroid.lat,
      lng: centroid.lng,
      createdAt: wish.createdAt,
      updatedAt: wish.updatedAt,
      deliveredAt: wish.deliveredAt ?? null,
    });
  }
  wishes.sort((a, b) => a.createdAt - b.createdAt);

  const wallPhotoById = new Map(wallPhotos.map((photo) => [photo.id, photo] as const));
  const wallTripById: Map<string, WallTrip> = new Map(wallTrips.map((trip) => [trip.id, trip] as const));
  const wallCityByKey = new Map(cities.map((city) => [city.key, city] as const));
  const wishById = new Map(wishes.map((wish) => [wish.id, wish] as const));

  return {
    trips: wallTrips,
    photos: wallPhotos,
    visits: wallVisits,
    cities,
    wishes,
    noGpsCount,
    photoById: wallPhotoById,
    tripById: wallTripById,
    cityByKey: wallCityByKey,
    wishById,
  };
}

function cityNameFallback(snapshot: ArchiveSnapshot, tripId: string): string {
  const trip = snapshot.trips.find((item) => item.id === tripId);
  return trip?.cityRefs[0]?.name ?? '未识别地点';
}

export function visitedCityKeys(model: WallModel): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const trip of model.trips) {
    for (const key of trip.cityKeys) keys.add(key);
  }
  return keys;
}

export function cityNamesOf(model: WallModel): ReadonlyMap<string, string> {
  const names = new Map<string, string>();
  for (const city of model.cities) names.set(city.key, city.name);
  for (const trip of model.trips) {
    for (const visit of trip.visits) names.set(visit.cityKey, visit.name);
  }
  return names;
}

export function latestTrip(model: WallModel): WallTrip | null {
  return model.trips[0] ?? null;
}

/** The last stop of the most recent trip; the frog waits there. */
export function frogAnchor(model: WallModel): { lat: number; lng: number; tripId: string } | null {
  for (const trip of model.trips) {
    const last = trip.visits[trip.visits.length - 1];
    if (last) return { lat: last.lat, lng: last.lng, tripId: trip.id };
  }
  return null;
}

export function isNewWish(wish: WallWish, now: number): boolean {
  if (wish.status !== 'received') return false;
  const age = now - (wish.deliveredAt ?? wish.createdAt);
  return age >= 0 && age < 21 * DAY_MS;
}

export function formattedDay(at: number): string {
  const date = new Date(at);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getUTCFullYear()}.${pad(date.getUTCMonth() + 1)}.${pad(date.getUTCDate())}`;
}
