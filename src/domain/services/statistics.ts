import type { CityRef } from '../city/city-ref';
import { UNKNOWN_COUNTRY_CODE } from '../city/city-ref';
import type { GeoPoint } from '../geo/geo-point';
import { localYear } from '../common/time';
import type { ManualVisit } from '../wish/manual-visit';
import type { Photo } from '../photo/photo';
import type { Trip } from '../trip/trip';
import type { Visit } from '../visit/visit';

export interface CityStat {
  readonly cityKey: string;
  readonly name: string;
  readonly countryCode: string;
  readonly countryName: string;
  readonly year: number;
  readonly photoCount: number;
  readonly tripCount: number;
  readonly sources: readonly ('trip' | 'manual')[];
  readonly centroid: GeoPoint | null;
}

export interface Footprint {
  readonly cities: readonly CityStat[];
  readonly cityCount: number;
  readonly countryCount: number;
  readonly tripCount: number;
  readonly photoCount: number;
  readonly years: readonly number[];
}

export interface FootprintInput {
  readonly trips: readonly Trip[];
  readonly visits: readonly Visit[];
  readonly photos: readonly Photo[];
  readonly manualVisits: readonly ManualVisit[];
  readonly year?: number;
}

function tripYear(trip: Trip): number {
  return localYear(trip.timeRange.end - 1, 0);
}

export function computeFootprint(input: FootprintInput): Footprint {
  const allYears = new Set<number>();
  for (const trip of input.trips) allYears.add(tripYear(trip));
  for (const visit of input.manualVisits) allYears.add(visit.year);

  const trips = input.year === undefined ? input.trips : input.trips.filter((trip) => tripYear(trip) === input.year);
  const tripIds = new Set(trips.map((trip) => trip.id));
  const visitsByTrip = new Map<string, Visit[]>();
  for (const visit of input.visits) {
    if (!tripIds.has(visit.tripId)) continue;
    const list = visitsByTrip.get(visit.tripId) ?? [];
    list.push(visit);
    visitsByTrip.set(visit.tripId, list);
  }

  const byCity = new Map<string, { city: CityRef; year: number; photoCount: number; tripIds: Set<string>; sources: Set<'trip' | 'manual'> }>();
  const photosByVisit = new Map<string, Photo[]>();
  for (const photo of input.photos) {
    if (photo.visitId === null) continue;
    const list = photosByVisit.get(photo.visitId) ?? [];
    list.push(photo);
    photosByVisit.set(photo.visitId, list);
  }

  for (const trip of trips) {
    const visits = visitsByTrip.get(trip.id) ?? [];
    const year = tripYear(trip);
    for (const visit of visits) {
      const entry = byCity.get(visit.cityRef.key) ?? {
        city: visit.cityRef,
        year,
        photoCount: 0,
        tripIds: new Set<string>(),
        sources: new Set<'trip' | 'manual'>(),
      };
      entry.year = Math.max(entry.year, year);
      entry.tripIds.add(trip.id);
      entry.sources.add('trip');
      const members = photosByVisit.get(visit.id) ?? [];
      entry.photoCount += members.length;
      byCity.set(visit.cityRef.key, entry);
    }
  }

  for (const visit of input.manualVisits) {
    if (input.year !== undefined && visit.year !== input.year) continue;
    const entry = byCity.get(visit.cityRef.key) ?? {
      city: visit.cityRef,
      year: visit.year,
      photoCount: 0,
      tripIds: new Set<string>(),
      sources: new Set<'trip' | 'manual'>(),
    };
    entry.year = Math.max(entry.year, visit.year);
    entry.sources.add('manual');
    entry.city = entry.sources.has('trip') ? entry.city : visit.cityRef;
    byCity.set(visit.cityRef.key, entry);
  }

  const cities: CityStat[] = Array.from(byCity.values())
    .map((entry) => ({
      cityKey: entry.city.key,
      name: entry.city.name,
      countryCode: entry.city.countryCode,
      countryName: entry.city.countryName,
      year: entry.year,
      photoCount: entry.photoCount,
      tripCount: entry.tripIds.size,
      sources: Array.from(entry.sources).sort(),
      centroid: entry.city.centroid,
    }))
    .sort((a, b) => b.year - a.year || b.photoCount - a.photoCount || a.name.localeCompare(b.name, 'zh-CN'));

  const countries = new Set(cities.filter((city) => city.countryCode !== UNKNOWN_COUNTRY_CODE).map((city) => city.countryCode));
  const countedPhotos = new Set<string>();
  for (const trip of trips) {
    for (const visit of visitsByTrip.get(trip.id) ?? []) {
      for (const photo of photosByVisit.get(visit.id) ?? []) countedPhotos.add(photo.id);
    }
  }

  return {
    cities,
    cityCount: cities.length,
    countryCount: countries.size,
    tripCount: trips.length,
    photoCount: countedPhotos.size,
    years: Array.from(allYears).sort((a, b) => b - a),
  };
}

export interface GapReport {
  readonly missingLocation: number;
  readonly missingTime: number;
  readonly tripsWithoutMemory: readonly Trip[];
  readonly tripsWithoutVisits: readonly Trip[];
  readonly wishesOpen: number;
  readonly wishesNext: number;
  readonly citiesWithoutPhotos: number;
}

export function computeGaps(input: {
  trips: readonly Trip[];
  visits: readonly Visit[];
  photos: readonly Photo[];
  wishes: readonly { status: 'wish' | 'next' | 'visited' }[];
  memories: readonly { tripId: string }[];
}): GapReport {
  const memoryTrips = new Set(input.memories.map((memory) => memory.tripId));
  const visitsByTrip = new Set(input.visits.map((visit) => visit.tripId));
  return {
    missingLocation: input.photos.filter((photo) => photo.geo === null && !photo.ignored).length,
    missingTime: input.photos.filter((photo) => photo.capturedAtSource === 'missing').length,
    tripsWithoutMemory: input.trips.filter((trip) => !memoryTrips.has(trip.id)),
    tripsWithoutVisits: input.trips.filter((trip) => !visitsByTrip.has(trip.id)),
    wishesOpen: input.wishes.filter((wish) => wish.status === 'wish').length,
    wishesNext: input.wishes.filter((wish) => wish.status === 'next').length,
    citiesWithoutPhotos: 0,
  };
}
