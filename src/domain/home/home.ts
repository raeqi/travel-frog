import type { CityRef } from '../city/city-ref';
import { makeCityRef } from '../city/city-ref';
import { domainError, err, ok, type Result } from '../common/result';
import type { Instant } from '../common/time';
import type { GeoPoint } from '../geo/geo-point';
import type { Photo } from '../photo/photo';
import type { Trip } from '../trip/trip';
import type { Visit } from '../visit/visit';
import {
  collectSpecialtyAwards,
  validateSpecialtyAward,
  type CityVisitEvidence,
  type SpecialtyAward,
} from './collection';
import { isFrogPerch, type FrogPerch } from './perch';

export interface HomeState {
  readonly city: CityRef;
  readonly marker: GeoPoint | null;
  readonly perch: FrogPerch;
  readonly specialties: readonly SpecialtyAward[];
  readonly updatedAt: Instant;
}

export const DEFAULT_HOME_CITY: CityRef = makeCityRef({
  name: '北京',
  countryCode: 'CHN',
  countryName: '中国',
  centroid: { lat: 39.9042, lng: 116.4074, accuracyM: null, source: 'candidate', approximate: true },
  source: 'gazetteer',
  confidence: 'high',
});

export const DEFAULT_HOME_STATE: HomeState = {
  city: DEFAULT_HOME_CITY,
  marker: DEFAULT_HOME_CITY.centroid,
  perch: 'armchair',
  specialties: [],
  updatedAt: 0,
};

export function isHomeCity(home: HomeState, cityKey: string): boolean {
  return home.city.key === cityKey;
}

/** Moving changes only the city and the house marker; the perch and every souvenir stay. */
export function moveHome(home: HomeState, city: CityRef, now: Instant): Result<HomeState> {
  if (city.name.trim().length === 0) {
    return err(domainError('VALIDATION_FAILED', '家的城市需要一个名称'));
  }
  if (city.centroid === null) {
    return err(domainError('GEO_INVALID', '家的城市缺少坐标，无法放置房子标记'));
  }
  return ok({
    ...home,
    city,
    marker: city.centroid,
    updatedAt: now,
  });
}

export function setHomePerch(home: HomeState, perch: FrogPerch, now: Instant): Result<HomeState> {
  if (!isFrogPerch(perch)) {
    return err(domainError('VALIDATION_FAILED', '未知的青蛙落脚点'));
  }
  return ok({ ...home, perch, updatedAt: now });
}

export function withSpecialtyAwards(
  home: HomeState,
  awards: readonly SpecialtyAward[],
  now: Instant,
): HomeState {
  if (awards.length === home.specialties.length) return home;
  return { ...home, specialties: [...awards], updatedAt: now };
}

export function collectCityVisitEvidence(input: {
  readonly trips: readonly Trip[];
  readonly visits: readonly Visit[];
  readonly photos: readonly Photo[];
  readonly homeCityKey: string;
}): CityVisitEvidence[] {
  const tripIds = new Set(input.trips.map((trip) => trip.id));
  const photosByVisit = new Map<string, string[]>();
  for (const photo of input.photos) {
    if (photo.visitId === null || photo.tripId === null || photo.ignored || photo.geo === null) continue;
    const list = photosByVisit.get(photo.visitId) ?? [];
    list.push(photo.id);
    photosByVisit.set(photo.visitId, list);
  }

  const evidence: CityVisitEvidence[] = [];
  for (const visit of input.visits) {
    if (!tripIds.has(visit.tripId)) continue;
    if (visit.cityRef.key === input.homeCityKey) continue;
    const photoIds = photosByVisit.get(visit.id);
    if (!photoIds || photoIds.length === 0) continue;
    evidence.push({
      city: visit.cityRef,
      tripId: visit.tripId,
      photoIds,
      at: visit.timeRange.start,
    });
  }
  return evidence;
}

export function syncHomeSpecialties(input: {
  readonly home: HomeState;
  readonly trips: readonly Trip[];
  readonly visits: readonly Visit[];
  readonly photos: readonly Photo[];
  readonly now: Instant;
}): HomeState {
  const evidence = collectCityVisitEvidence({
    trips: input.trips,
    visits: input.visits,
    photos: input.photos,
    homeCityKey: input.home.city.key,
  });
  const awards = collectSpecialtyAwards(input.home.specialties, evidence, input.now);
  return withSpecialtyAwards(input.home, awards, input.now);
}

export function validateHomeState(home: HomeState): Result<HomeState> {
  if (home.city.name.trim().length === 0) {
    return err(domainError('VALIDATION_FAILED', '家的城市名称不能为空'));
  }
  if (!isFrogPerch(home.perch)) {
    return err(domainError('VALIDATION_FAILED', '未知的青蛙落脚点'));
  }
  if (home.marker !== null) {
    if (
      !Number.isFinite(home.marker.lat) ||
      !Number.isFinite(home.marker.lng) ||
      home.marker.lat < -90 ||
      home.marker.lat > 90 ||
      home.marker.lng < -180 ||
      home.marker.lng > 180
    ) {
      return err(domainError('GEO_INVALID', '家的房子标记坐标非法'));
    }
  }
  const seen = new Set<string>();
  for (const award of home.specialties) {
    const checked = validateSpecialtyAward(award);
    if (!checked.ok) return checked;
    if (seen.has(award.specialtyId)) {
      return err(domainError('VALIDATION_FAILED', '同一件特产不能重复获得'));
    }
    seen.add(award.specialtyId);
  }
  if (!Number.isFinite(home.updatedAt)) {
    return err(domainError('VALIDATION_FAILED', '家的更新时间无效'));
  }
  return ok(home);
}
