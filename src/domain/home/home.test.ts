import { describe, expect, it } from 'vitest';
import type { CityRef } from '../city/city-ref';
import { makeCityRef } from '../city/city-ref';
import type { Photo } from '../photo/photo';
import type { Trip } from '../trip/trip';
import type { Visit } from '../visit/visit';
import { computeFootprint } from '../services/statistics';
import {
  CURIO_CAPACITY,
  collectSpecialtyAwards,
  curioSlots,
  furnitureFor,
  furnitureStage,
  luggageTier,
  specialtiesForCity,
  visibleSpecialties,
} from './collection';
import {
  DEFAULT_HOME_STATE,
  collectCityVisitEvidence,
  moveHome,
  setHomePerch,
  syncHomeSpecialties,
  validateHomeState,
} from './home';
import { FROG_PERCHES, nextPerch, perchForDisplay, perchFromRandom, type FrogPerch } from './perch';

const NOW = Date.UTC(2026, 5, 1, 9, 0);

function city(
  name: string,
  countryCode: string,
  countryName: string,
  lat: number,
  lng: number,
): CityRef {
  return makeCityRef({
    name,
    countryCode,
    countryName,
    centroid: { lat, lng, accuracyM: null, source: 'candidate', approximate: true },
    source: 'gazetteer',
    confidence: 'high',
  });
}

const BEIJING = city('北京', 'CHN', '中国', 39.9042, 116.4074);
const KYOTO = city('京都', 'JPN', '日本', 35.0116, 135.7681);
const LISBON = city('里斯本', 'PRT', '葡萄牙', 38.7223, -9.1393);

function trip(id: string, cities: readonly CityRef[], start = NOW): Trip {
  return {
    id: id as never,
    title: `旅行 ${id}`,
    timeRange: { start, end: start + 86_400_000 },
    cityRefs: cities,
    memoryId: null,
    coverPhotoId: null,
    sourceCandidateId: null,
    origin: 'user',
    createdAt: start,
    updatedAt: start,
  };
}

function visit(id: string, tripId: string, cityRef: CityRef, sequence: number, start = NOW): Visit {
  return {
    id: id as never,
    tripId: tripId as never,
    sequence,
    cityRef,
    displayName: cityRef.name,
    timeRange: { start, end: start + 3_600_000 },
    geo: cityRef.centroid,
    locationSource: 'exif',
    confidence: 'high',
  };
}

function photo(id: string, tripId: string, visitId: string | null, geo: boolean): Photo {
  return {
    id: id as never,
    importBatchId: 'batch' as never,
    fileName: `${id}.jpg`,
    mimeType: 'image/jpeg',
    byteSize: 1,
    contentHash: null,
    capturedAt: NOW,
    capturedAtSource: 'exif-original',
    captureOffsetMinutes: 540,
    offsetSource: 'exif',
    originalCapturedAt: NOW,
    geo: geo ? { lat: 35, lng: 135, accuracyM: null, source: 'exif', approximate: false } : null,
    locationSource: geo ? 'exif' : 'none',
    thumbRef: null,
    tripId: tripId as never,
    visitId: visitId as never,
    candidateId: null,
    ignored: false,
    issues: [],
    origin: 'user',
    importedAt: NOW,
    updatedAt: NOW,
  };
}

describe('home city exclusion', () => {
  it('keeps Beijing out of city, country, trip and photo statistics', () => {
    const mixed = trip('t1', [KYOTO, BEIJING]);
    const homeOnly = trip('t2', [BEIJING], NOW + 10 * 86_400_000);
    const visits = [
      visit('v1', 't1', KYOTO, 0),
      visit('v2', 't1', BEIJING, 1, NOW + 3_600_000),
      visit('v3', 't2', BEIJING, 0, NOW + 10 * 86_400_000),
    ];
    const photos = [
      photo('p1', 't1', 'v1', true),
      photo('p2', 't1', 'v1', true),
      photo('p3', 't1', 'v2', true),
      photo('p4', 't2', 'v3', true),
    ];

    const footprint = computeFootprint({
      trips: [mixed, homeOnly],
      visits,
      photos,
      manualVisits: [],
      homeCityKey: BEIJING.key,
    });

    expect(footprint.cityCount).toBe(1);
    expect(footprint.cities.map((item) => item.name)).toEqual(['京都']);
    expect(footprint.countryCount).toBe(1);
    expect(footprint.tripCount).toBe(1);
    expect(footprint.photoCount).toBe(2);
  });

  it('still counts every trip when no home city is supplied', () => {
    const mixed = trip('t1', [KYOTO, BEIJING]);
    const visits = [visit('v1', 't1', KYOTO, 0), visit('v2', 't1', BEIJING, 1)];
    const photos = [photo('p1', 't1', 'v1', true), photo('p2', 't1', 'v2', true)];
    const footprint = computeFootprint({ trips: [mixed], visits, photos, manualVisits: [] });
    expect(footprint.cityCount).toBe(2);
    expect(footprint.countryCount).toBe(2);
    expect(footprint.photoCount).toBe(2);
    expect(footprint.tripCount).toBe(1);
  });
});

describe('home state', () => {
  it('defaults to Beijing and keeps the perch and souvenirs when moving', () => {
    expect(DEFAULT_HOME_STATE.city.key).toBe(BEIJING.key);
    expect(DEFAULT_HOME_STATE.perch).toBe('armchair');

    const awarded = syncHomeSpecialties({
      home: DEFAULT_HOME_STATE,
      trips: [trip('t1', [KYOTO])],
      visits: [visit('v1', 't1', KYOTO, 0)],
      photos: [photo('p1', 't1', 'v1', true)],
      now: NOW,
    });
    expect(awarded.specialties.length).toBeGreaterThan(0);

    const moved = moveHome(awarded, LISBON, NOW + 1000);
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    expect(moved.value.city.key).toBe(LISBON.key);
    expect(moved.value.marker?.lat).toBe(LISBON.centroid?.lat);
    expect(moved.value.perch).toBe(awarded.perch);
    expect(moved.value.specialties).toEqual(awarded.specialties);
  });

  it('changes the perch without creating a second frog', () => {
    const next = setHomePerch(DEFAULT_HOME_STATE, 'curio', NOW);
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    expect(next.value.perch).toBe('curio');
    expect(validateHomeState(next.value).ok).toBe(true);
  });

  it('builds evidence only for non-home visits with located photos', () => {
    const evidence = collectCityVisitEvidence({
      trips: [trip('t1', [KYOTO, BEIJING])],
      visits: [visit('v1', 't1', KYOTO, 0), visit('v2', 't1', BEIJING, 1)],
      photos: [
        photo('p1', 't1', 'v1', true),
        photo('p2', 't1', 'v2', true),
        photo('p3', 't1', 'v1', false),
      ],
      homeCityKey: BEIJING.key,
    });
    expect(evidence).toHaveLength(1);
    expect(evidence[0]?.city.key).toBe(KYOTO.key);
    expect(evidence[0]?.photoIds).toEqual(['p1']);
  });
});

describe('specialties', () => {
  it('gives every city one or two souvenirs and fills empty curio slots with placeholders', () => {
    expect(specialtiesForCity(KYOTO).length).toBe(2);
    expect(specialtiesForCity(LISBON).length).toBe(2);
    const unknown = city('某城', 'XXX', '未知', 10, 10);
    expect(specialtiesForCity(unknown)).toHaveLength(1);
    expect(curioSlots([])).toHaveLength(CURIO_CAPACITY);
    expect(curioSlots([]).every((slot) => slot.specialty === null)).toBe(true);
  });

  it('awards only cities with photo evidence and never duplicates a souvenir', () => {
    const evidence = [
      { city: KYOTO, tripId: 't1', photoIds: ['p1'], at: NOW },
      { city: LISBON, tripId: 't2', photoIds: [], at: NOW },
    ];
    const first = collectSpecialtyAwards([], evidence, NOW);
    expect(first).toHaveLength(2);
    expect(first.every((award) => award.cityKey === KYOTO.key)).toBe(true);
    const second = collectSpecialtyAwards(first, evidence, NOW + 1000);
    expect(second).toEqual(first);
    expect(visibleSpecialties(first)).toHaveLength(2);
  });
});

describe('growth thresholds', () => {
  it('uses 4 and 8 countries for the three luggage tiers', () => {
    expect(luggageTier(3)).toBe('small');
    expect(luggageTier(4)).toBe('standard');
    expect(luggageTier(7)).toBe('standard');
    expect(luggageTier(8)).toBe('wardrobe');
  });

  it('uses 3 trips and the combined 4 countries / 6 trips gate for furniture', () => {
    expect(furnitureStage(2, 10)).toBe('base');
    expect(furnitureStage(3, 1)).toBe('settled');
    expect(furnitureStage(5, 3)).toBe('settled');
    expect(furnitureStage(6, 3)).toBe('settled');
    expect(furnitureStage(6, 4)).toBe('collected');

    expect(furnitureFor({ tripCount: 2, countryCount: 10 })).toMatchObject({
      stage: 'base',
      fireplaceLit: false,
      sideboard: false,
      floorLampLit: false,
      globe: false,
      suitcaseFilled: false,
    });
    expect(furnitureFor({ tripCount: 3, countryCount: 1 })).toMatchObject({
      stage: 'settled',
      fireplaceLit: true,
      sideboard: true,
      bookshelf: true,
      suitcaseFilled: true,
      floorLampLit: false,
      globe: false,
    });
    expect(furnitureFor({ tripCount: 6, countryCount: 4 })).toMatchObject({
      stage: 'collected',
      floorLampLit: true,
      globe: true,
      curioFilled: true,
    });
  });
});

describe('frog perches', () => {
  it('has exactly six distinct perches and cycles through them', () => {
    expect(new Set(FROG_PERCHES).size).toBe(6);
    let perch: FrogPerch = FROG_PERCHES[0];
    const seen = new Set<string>();
    for (let index = 0; index < FROG_PERCHES.length; index += 1) {
      seen.add(perch);
      perch = nextPerch(perch);
    }
    expect(seen.size).toBe(6);
    expect(perch).toBe(FROG_PERCHES[0]);
  });

  it('maps displays and random entry to a single perch', () => {
    expect(perchForDisplay('map')).toBe('armchair');
    expect(perchForDisplay('postcard-wall')).toBe('bookshelf');
    expect(perchForDisplay('curio')).toBe('curio');
    expect(perchForDisplay('fireplace')).toBe('fireplace-rug');
    expect(perchForDisplay('suitcase')).toBe('suitcase');
    expect(perchForDisplay('lamp')).toBe('footstool');
    expect(perchFromRandom(0)).toBe(FROG_PERCHES[0]);
    expect(perchFromRandom(0.999)).toBe(FROG_PERCHES[5]);
    expect(perchFromRandom(Number.NaN)).toBe(FROG_PERCHES[0]);
  });
});
