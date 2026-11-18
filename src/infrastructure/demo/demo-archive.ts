import type { Candidate } from '../../domain/candidate/candidate';
import { makeCityRef, type CityRef } from '../../domain/city/city-ref';
import { asCandidateId, asImportBatchId, asManualVisitId, asMemoryId, asPhotoId, asTripId, asVisitId, asWishId } from '../../domain/common/ids';
import type { ImportBatch } from '../../domain/import/import-issue';
import type { Memory } from '../../domain/memory/memory';
import type { Photo } from '../../domain/photo/photo';
import type { Trip } from '../../domain/trip/trip';
import type { Visit } from '../../domain/visit/visit';
import type { ManualVisit } from '../../domain/wish/manual-visit';
import type { Wish } from '../../domain/wish/wish';

export interface DemoArchive {
  readonly batch: ImportBatch;
  readonly trips: readonly Trip[];
  readonly photos: readonly Photo[];
  readonly visits: readonly Visit[];
  readonly candidates: readonly Candidate[];
  readonly memories: readonly Memory[];
  readonly wishes: readonly Wish[];
  readonly manualVisits: readonly ManualVisit[];
}

const BATCH_ID = asImportBatchId('batch_demo');
const at = (year: number, month: number, day: number, hour = 10, minute = 0): number =>
  Date.UTC(year, month - 1, day, hour, minute);

interface CitySeed {
  name: string;
  countryName: string;
  countryCode: string;
  lat: number;
  lng: number;
}

const CITIES: Record<string, CitySeed> = {
  kyoto: { name: '京都', countryName: '日本', countryCode: 'JPN', lat: 35.0116, lng: 135.7681 },
  osaka: { name: '大阪', countryName: '日本', countryCode: 'JPN', lat: 34.6937, lng: 135.5023 },
  shanghai: { name: '上海', countryName: '中国', countryCode: 'CHN', lat: 31.2304, lng: 121.4737 },
  hangzhou: { name: '杭州', countryName: '中国', countryCode: 'CHN', lat: 30.2741, lng: 120.1551 },
  chengdu: { name: '成都', countryName: '中国', countryCode: 'CHN', lat: 30.5728, lng: 104.0668 },
  chongqing: { name: '重庆', countryName: '中国', countryCode: 'CHN', lat: 29.563, lng: 106.5516 },
  qingdao: { name: '青岛', countryName: '中国', countryCode: 'CHN', lat: 36.0671, lng: 120.3826 },
  harbin: { name: '哈尔滨', countryName: '中国', countryCode: 'CHN', lat: 45.8038, lng: 126.535 },
  paris: { name: '巴黎', countryName: '法国', countryCode: 'FRA', lat: 48.8566, lng: 2.3522 },
  rome: { name: '罗马', countryName: '意大利', countryCode: 'ITA', lat: 41.9028, lng: 12.4964 },
  bangkok: { name: '曼谷', countryName: '泰国', countryCode: 'THA', lat: 13.7563, lng: 100.5018 },
  reykjavik: { name: '雷克雅未克', countryName: '冰岛', countryCode: 'ISL', lat: 64.1466, lng: -21.9426 },
  cappadocia: { name: '卡帕多奇亚', countryName: '土耳其', countryCode: 'TUR', lat: 38.6431, lng: 34.8289 },
  lisbon: { name: '里斯本', countryName: '葡萄牙', countryCode: 'PRT', lat: 38.7223, lng: -9.1393 },
  naoshima: { name: '直岛', countryName: '日本', countryCode: 'JPN', lat: 34.4597, lng: 133.9957 },
  queenstown: { name: '皇后镇', countryName: '新西兰', countryCode: 'NZL', lat: -45.0312, lng: 168.6626 },
  kanazawa: { name: '金泽', countryName: '日本', countryCode: 'JPN', lat: 36.5613, lng: 136.6562 },
  seoul: { name: '首尔', countryName: '韩国', countryCode: 'KOR', lat: 37.5665, lng: 126.978 },
};

function city(key: string): CityRef {
  const seed = CITIES[key];
  if (!seed) throw new Error(`unknown demo city ${key}`);
  return makeCityRef({
    name: seed.name,
    countryCode: seed.countryCode,
    countryName: seed.countryName,
    centroid: { lat: seed.lat, lng: seed.lng, accuracyM: null, source: 'candidate', approximate: true },
    source: 'gazetteer',
    confidence: 'high',
  });
}

let sequence = 0;

function photo(options: {
  id: string;
  tripId: string | null;
  visitId: string | null;
  cityKey: string;
  capturedAt: number;
  located: boolean;
  candidateId?: string;
}): Photo {
  sequence += 1;
  const seed = CITIES[options.cityKey];
  if (!seed) throw new Error(`unknown demo city ${options.cityKey}`);
  const jitterLat = ((sequence % 7) - 3) * 0.004;
  const jitterLng = ((sequence % 5) - 2) * 0.004;
  const geo = options.located
    ? { lat: seed.lat + jitterLat, lng: seed.lng + jitterLng, accuracyM: null, source: 'exif' as const, approximate: false }
    : null;
  return {
    id: asPhotoId(options.id),
    importBatchId: BATCH_ID,
    fileName: `${options.id}.jpg`,
    mimeType: 'image/jpeg',
    byteSize: 1_800_000 + (sequence % 9) * 120_000,
    contentHash: null,
    capturedAt: options.capturedAt,
    capturedAtSource: 'exif-original',
    captureOffsetMinutes: 480,
    offsetSource: 'exif',
    originalCapturedAt: null,
    geo,
    locationSource: geo ? 'exif' : 'none',
    thumbRef: null,
    tripId: options.tripId === null ? null : asTripId(options.tripId),
    visitId: options.visitId === null ? null : asVisitId(options.visitId),
    candidateId: options.candidateId ?? null,
    ignored: false,
    issues: [],
    origin: 'demo',
    importedAt: at(2025, 6, 1),
    updatedAt: at(2025, 6, 1),
  };
}

interface TripSpec {
  key: string;
  title: string;
  start: number;
  end: number;
  cities: string[];
  visits: { id: string; cityKey: string; start: number; end: number; weight: number }[];
  memory: string | null;
}

const TRIPS: readonly TripSpec[] = [
  {
    key: 'trip_demo_kyoto',
    title: '2025 京都 · 大阪 春末',
    start: at(2025, 5, 2, 0),
    end: at(2025, 5, 8, 0),
    cities: ['kyoto', 'osaka'],
    visits: [
      { id: 'visit_demo_kyoto_1', cityKey: 'kyoto', start: at(2025, 5, 2, 9), end: at(2025, 5, 4, 21), weight: 24 },
      { id: 'visit_demo_kyoto_2', cityKey: 'osaka', start: at(2025, 5, 5, 10), end: at(2025, 5, 7, 21), weight: 15 },
    ],
    memory: '在伏见稻荷的千本鸟居下，你说下次还要来。',
  },
  {
    key: 'trip_demo_shanghai',
    title: '2025 上海 · 杭州 早春',
    start: at(2025, 2, 14, 0),
    end: at(2025, 2, 19, 0),
    cities: ['shanghai', 'hangzhou'],
    visits: [
      { id: 'visit_demo_sh_1', cityKey: 'shanghai', start: at(2025, 2, 14, 10), end: at(2025, 2, 16, 21), weight: 12 },
      { id: 'visit_demo_sh_2', cityKey: 'hangzhou', start: at(2025, 2, 17, 9), end: at(2025, 2, 18, 20), weight: 9 },
    ],
    memory: '雨后的西湖，比照片里更安静。',
  },
  {
    key: 'trip_demo_chengdu',
    title: '2024 成都 · 重庆 秋日',
    start: at(2024, 10, 1, 0),
    end: at(2024, 10, 7, 0),
    cities: ['chengdu', 'chongqing'],
    visits: [
      { id: 'visit_demo_cd_1', cityKey: 'chengdu', start: at(2024, 10, 1, 9), end: at(2024, 10, 3, 21), weight: 14 },
      { id: 'visit_demo_cd_2', cityKey: 'chongqing', start: at(2024, 10, 4, 10), end: at(2024, 10, 6, 21), weight: 11 },
    ],
    memory: '在人民公园喝了一下午的茶。',
  },
  {
    key: 'trip_demo_qingdao',
    title: '2024 青岛 海边四日',
    start: at(2024, 6, 21, 0),
    end: at(2024, 6, 25, 0),
    cities: ['qingdao'],
    visits: [{ id: 'visit_demo_qd_1', cityKey: 'qingdao', start: at(2024, 6, 21, 9), end: at(2024, 6, 24, 20), weight: 13 }],
    memory: null,
  },
  {
    key: 'trip_demo_harbin',
    title: '2023 哈尔滨 跨年',
    start: at(2023, 12, 30, 0),
    end: at(2024, 1, 2, 0),
    cities: ['harbin'],
    visits: [{ id: 'visit_demo_hb_1', cityKey: 'harbin', start: at(2023, 12, 30, 10), end: at(2024, 1, 1, 22), weight: 12 }],
    memory: '零下二十五度，糖葫芦是热的。',
  },
  {
    key: 'trip_demo_paris',
    title: '2023 巴黎 · 罗马 初秋',
    start: at(2023, 9, 12, 0),
    end: at(2023, 9, 21, 0),
    cities: ['paris', 'rome'],
    visits: [
      { id: 'visit_demo_pr_1', cityKey: 'paris', start: at(2023, 9, 12, 9), end: at(2023, 9, 15, 21), weight: 11 },
      { id: 'visit_demo_pr_2', cityKey: 'rome', start: at(2023, 9, 16, 10), end: at(2023, 9, 20, 21), weight: 10 },
    ],
    memory: '在塞纳河边走到天黑。',
  },
];

/** Deterministic demo archive. Only loaded through the explicit "加载示例档案" action. */
export function buildDemoArchive(now: number): DemoArchive {
  sequence = 0;
  const trips: Trip[] = [];
  const visits: Visit[] = [];
  const photos: Photo[] = [];
  const memories: Memory[] = [];

  for (const spec of TRIPS) {
    const tripId = asTripId(spec.key);
    const cityRefs = spec.cities.map((key) => city(key));
    trips.push({
      id: tripId,
      title: spec.title,
      timeRange: { start: spec.start, end: spec.end },
      cityRefs,
      memoryId: spec.memory ? asMemoryId(`memory_${spec.key}`) : null,
      coverPhotoId: null,
      sourceCandidateId: null,
      origin: 'demo',
      createdAt: spec.start,
      updatedAt: now,
    });

    let index = 0;
    for (const visitSpec of spec.visits) {
      const span = visitSpec.end - visitSpec.start;
      const members: Photo[] = [];
      for (let count = 0; count < visitSpec.weight; count += 1) {
        index += 1;
        const id = `photo_${spec.key}_${index}`;
        const located = !(spec.key === 'trip_demo_kyoto' && visitSpec.cityKey === 'kyoto' && count >= 8 && count < 12);
        const capturedAt = visitSpec.start + Math.floor((span * (count + 1)) / (visitSpec.weight + 1));
        members.push(
          photo({
            id,
            tripId: spec.key,
            visitId: visitSpec.id,
            cityKey: visitSpec.cityKey,
            capturedAt,
            located,
          }),
        );
      }
      const first = members[0];
      const last = members[members.length - 1];
      photos.push(...members);
      if (!first || !last) continue;
      visits.push({
        id: asVisitId(visitSpec.id),
        tripId,
        sequence: visits.filter((visit) => visit.tripId === tripId).length,
        cityRef: city(visitSpec.cityKey),
        displayName: CITIES[visitSpec.cityKey]?.name ?? '未识别地点',
        timeRange: { start: first.capturedAt, end: last.capturedAt + 1 },
        geo: {
          lat: CITIES[visitSpec.cityKey]?.lat ?? 0,
          lng: CITIES[visitSpec.cityKey]?.lng ?? 0,
          accuracyM: null,
          source: 'exif',
          approximate: false,
        },
        locationSource: 'exif',
        confidence: members.length >= 8 ? 'high' : 'medium',
      });
    }

    if (spec.memory) {
      memories.push({
        id: asMemoryId(`memory_${spec.key}`),
        tripId,
        text: spec.memory,
        origin: 'demo',
        createdAt: spec.start,
        updatedAt: now,
      });
    }
  }

  for (const trip of trips) {
    const first = photos.find((item) => item.tripId === trip.id);
    if (first) {
      const index = trips.indexOf(trip);
      trips[index] = { ...trip, coverPhotoId: first.id };
    }
  }

  const candidateSpecs = [
    { id: 'cand_demo_kyoto', cityKey: 'kyoto', start: at(2026, 10, 2, 9), weight: 6 },
    { id: 'cand_demo_paris', cityKey: 'paris', start: at(2026, 9, 18, 10), weight: 5 },
  ];
  const candidates: Candidate[] = [];
  for (const spec of candidateSpecs) {
    const members: Photo[] = [];
    for (let count = 0; count < spec.weight; count += 1) {
      const id = `photo_${spec.id}_${count + 1}`;
      members.push(
        photo({
          id,
          tripId: null,
          visitId: null,
          cityKey: spec.cityKey,
          capturedAt: spec.start + count * 3_600_000,
          located: true,
          candidateId: spec.id,
        }),
      );
    }
    photos.push(...members);
    const first = members[0];
    const last = members[members.length - 1];
    if (!first || !last) continue;
    candidates.push({
      id: asCandidateId(spec.id),
      importBatchId: BATCH_ID,
      timeRange: { start: first.capturedAt - 6 * 3_600_000, end: last.capturedAt + 6 * 3_600_000 },
      photoIds: members.map((item) => item.id),
      cityRefs: [city(spec.cityKey)],
      locationMissingCount: 0,
      splitReasons: ['manual'],
      confidence: 'high',
      status: 'pending',
      derivedFrom: [],
      supersededBy: [],
      confirmedTripId: null,
      origin: 'demo',
      createdAt: at(2026, 10, 5),
      updatedAt: at(2026, 10, 5),
    });
  }

  const wishSpecs: {
    key: string;
    cityKey: string;
    status: 'pending' | 'received' | 'wished' | 'fulfilled' | 'declined';
    region: string;
    note: string | null;
    from: string | null;
  }[] = [
    { key: 'wish_demo_kanazawa', cityKey: 'kanazawa', status: 'pending', region: '北陆', note: null, from: null },
    {
      key: 'wish_demo_seoul',
      cityKey: 'seoul',
      status: 'received',
      region: '汉江边',
      note: '替你走到南山塔下，风把围巾吹得很响。',
      from: 'kyoto',
    },
    {
      key: 'wish_demo_reykjavik',
      cityKey: 'reykjavik',
      status: 'wished',
      region: '大西洋沿岸',
      note: '凌晨的港口只有灯塔亮着，替你站了一会儿。',
      from: 'paris',
    },
    {
      key: 'wish_demo_naoshima',
      cityKey: 'naoshima',
      status: 'fulfilled',
      region: '濑户内海',
      note: '南瓜还坐在海边，替你数了来往的船。',
      from: 'kyoto',
    },
    {
      key: 'wish_demo_queenstown',
      cityKey: 'queenstown',
      status: 'declined',
      region: '南岛',
      note: '雪线退得很低，山谷里没有人。',
      from: 'osaka',
    },
  ];
  const wishes: Wish[] = wishSpecs.map((spec) => ({
    id: asWishId(spec.key),
    cityRef: city(spec.cityKey),
    region: spec.region,
    note: spec.note,
    status: spec.status,
    source: 'frog',
    from: spec.from,
    origin: 'demo',
    createdAt: at(2025, 8, 1),
    updatedAt: now,
  }));

  const manualVisits: ManualVisit[] = [
    {
      id: asManualVisitId('mvisit_demo_bangkok'),
      cityRef: city('bangkok'),
      year: 2024,
      source: 'manual',
      sourceWishId: null,
      createdAt: at(2024, 11, 1),
    },
  ];

  return {
    batch: {
      id: BATCH_ID,
      startedAt: at(2025, 6, 1),
      finishedAt: at(2025, 6, 1),
      sourceFileCount: photos.length,
      photoCount: photos.length,
      issueCount: 0,
      candidateCount: candidates.length,
      status: 'completed',
      origin: 'demo',
    },
    trips,
    photos,
    visits,
    candidates,
    memories,
    wishes,
    manualVisits,
  };
}
