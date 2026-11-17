import type { AppData, Photo, Trip, Visit, Wish } from '../types';
import { nearestCity } from './geo';
import { DEFAULT_CONFIG } from './splitTrips';

const thumbCache = new Map<string, string>();

export function svgThumb(label: string, caption: string, tone = 0): string {
  const key = `${label}|${caption}|${tone}`;
  const cached = thumbCache.get(key);
  if (cached) return cached;
  const shade = ['#e8e8e8', '#e4e4e4', '#ececec', '#e0e0e0'][tone % 4];
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">` +
    `<rect width="160" height="160" fill="${shade}"/>` +
    `<path d="M0 160L160 0M40 160L160 40M0 120L120 0" stroke="#c9c9c9" stroke-width="1"/>` +
    `<rect x="18" y="54" width="124" height="52" fill="${shade}"/>` +
    `<text x="80" y="78" text-anchor="middle" font-family="system-ui,sans-serif" font-size="13" fill="#6f6f6f">${escapeXml(label)}</text>` +
    `<text x="80" y="94" text-anchor="middle" font-family="ui-monospace,monospace" font-size="9" fill="#9a9a9a">${escapeXml(caption)}</text>` +
    `</svg>`;
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  thumbCache.set(key, url);
  return url;
}

function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!));
}

interface VisitSpec {
  name: string;
  day: number;
  hour: number;
  minute?: number;
  count: number;
  lat: number;
  lng: number;
}

interface TripSpec {
  id: string;
  title: string;
  start: [number, number, number];
  end: [number, number, number];
  memory: string;
  cities: string[];
  visits: VisitSpec[];
  missing?: { day: number; hour: number; count: number; name: string }[];
}

const toTime = (y: number, m: number, d: number, h = 10, min = 0) => new Date(y, m - 1, d, h, min).getTime();

const TRIP_SPECS: TripSpec[] = [
  {
    id: 'demo-kyoto',
    title: '2025 京都 · 大阪 春末',
    start: [2025, 5, 2],
    end: [2025, 5, 7],
    memory: '在伏见稻荷的千本鸟居下，你说下次还要来。',
    cities: ['京都', '大阪'],
    visits: [
      { name: '京都站', day: 0, hour: 14, minute: 20, count: 12, lat: 34.9858, lng: 135.7588 },
      { name: '清水寺', day: 1, hour: 9, minute: 10, count: 9, lat: 34.9949, lng: 135.785 },
      { name: '伏见稻荷大社', day: 1, hour: 16, minute: 40, count: 11, lat: 34.9671, lng: 135.7727 },
      { name: '岚山', day: 2, hour: 11, minute: 5, count: 7, lat: 35.0094, lng: 135.6668 },
      { name: '大阪城', day: 3, hour: 10, minute: 30, count: 9, lat: 34.6873, lng: 135.5262 },
      { name: '道顿堀', day: 4, hour: 18, minute: 0, count: 3, lat: 34.6687, lng: 135.5013 },
    ],
    missing: [{ day: 2, hour: 17, count: 5, name: '岚山 · 无定位' }, { day: 3, hour: 16, count: 7, name: '大阪 · 无定位' }],
  },
  {
    id: 'demo-shanghai',
    title: '2025 上海 · 杭州 初春',
    start: [2025, 2, 14],
    end: [2025, 2, 18],
    memory: '外滩的风很大，梧桐叶落在相机包上。',
    cities: ['上海', '杭州'],
    visits: [
      { name: '外滩', day: 0, hour: 19, minute: 10, count: 14, lat: 31.2404, lng: 121.4904 },
      { name: '武康路', day: 1, hour: 10, minute: 0, count: 10, lat: 31.2047, lng: 121.4386 },
      { name: '西湖', day: 2, hour: 9, minute: 30, count: 16, lat: 30.2489, lng: 120.1428 },
      { name: '龙井村', day: 3, hour: 11, minute: 0, count: 8, lat: 30.2192, lng: 120.1063 },
    ],
  },
  {
    id: 'demo-chengdu',
    title: '2024 成都 · 重庆 国庆',
    start: [2024, 10, 1],
    end: [2024, 10, 6],
    memory: '在竹椅上坐了一下午，什么都没做。',
    cities: ['成都', '重庆'],
    visits: [
      { name: '宽窄巷子', day: 0, hour: 15, minute: 0, count: 14, lat: 30.6631, lng: 104.0559 },
      { name: '人民公园', day: 1, hour: 10, minute: 30, count: 12, lat: 30.6571, lng: 104.0556 },
      { name: '大熊猫基地', day: 2, hour: 9, minute: 0, count: 16, lat: 30.7333, lng: 104.1451 },
      { name: '洪崖洞', day: 3, hour: 19, minute: 30, count: 13, lat: 29.5628, lng: 106.5786 },
      { name: '解放碑', day: 4, hour: 11, minute: 0, count: 11, lat: 29.5574, lng: 106.5771 },
      { name: '磁器口', day: 4, hour: 15, minute: 30, count: 12, lat: 29.5804, lng: 106.4497 },
      { name: '南山', day: 5, hour: 16, minute: 0, count: 9, lat: 29.5362, lng: 106.5901 },
    ],
  },
  {
    id: 'demo-qingdao',
    title: '2024 青岛 夏至',
    start: [2024, 6, 21],
    end: [2024, 6, 24],
    memory: '海边的风把伞吹翻，你笑了很久。',
    cities: ['青岛'],
    visits: [
      { name: '栈桥', day: 0, hour: 16, minute: 0, count: 10, lat: 36.0611, lng: 120.3167 },
      { name: '八大关', day: 1, hour: 10, minute: 0, count: 8, lat: 36.0546, lng: 120.3449 },
      { name: '五四广场', day: 2, hour: 18, minute: 30, count: 7, lat: 36.0624, lng: 120.3851 },
      { name: '崂山', day: 3, hour: 9, minute: 30, count: 6, lat: 36.1867, lng: 120.6325 },
    ],
  },
  {
    id: 'demo-harbin',
    title: '2023 哈尔滨 跨年',
    start: [2023, 12, 30],
    end: [2024, 1, 2],
    memory: '零下二十度，手机先没电了。',
    cities: ['哈尔滨'],
    visits: [
      { name: '中央大街', day: 0, hour: 15, minute: 0, count: 20, lat: 45.7735, lng: 126.6167 },
      { name: '索菲亚教堂', day: 1, hour: 10, minute: 30, count: 14, lat: 45.7682, lng: 126.6211 },
      { name: '冰雪大世界', day: 2, hour: 18, minute: 0, count: 18, lat: 45.7805, lng: 126.5653 },
    ],
  },
];

function buildDemoTrip(spec: TripSpec): { trip: Trip; photos: Photo[] } {
  const [sy, sm, sd] = spec.start;
  const [ey, em, ed] = spec.end;
  const photos: Photo[] = [];
  const visits: Visit[] = [];

  for (const v of spec.visits) {
    const startAt = toTime(sy, sm, sd + v.day, v.hour, v.minute ?? 0);
    const hit = nearestCity(v.lat, v.lng);
    const visit: Visit = {
      id: `${spec.id}-v${visits.length + 1}`,
      tripId: spec.id,
      name: v.name,
      city: hit?.city ?? spec.cities[0],
      country: hit?.country ?? '',
      startAt,
      endAt: startAt + 60 * 60 * 1000,
      lat: v.lat,
      lng: v.lng,
      photoCount: v.count,
    };
    visits.push(visit);
    for (let i = 0; i < v.count; i += 1) {
      const t = startAt + i * 4 * 60 * 1000 + (i % 3) * 25 * 1000;
      const id = `${spec.id}-p${photos.length + 1}`;
      photos.push({
        id,
        name: `IMG_${String(2400 + photos.length).padStart(4, '0')}.JPG`,
        takenAt: t,
        lat: v.lat + ((i % 5) - 2) * 0.0006,
        lng: v.lng + ((i % 7) - 3) * 0.0006,
        thumb: svgThumb(v.name, `${String(new Date(t).getMonth() + 1).padStart(2, '0')}-${String(new Date(t).getDate()).padStart(2, '0')} ${String(new Date(t).getHours()).padStart(2, '0')}:${String(new Date(t).getMinutes()).padStart(2, '0')}`, photos.length),
        locationSource: 'exif',
        placeLabel: v.name,
        tripId: spec.id,
        visitId: visit.id,
      });
    }
    visit.endAt = startAt + Math.max(0, v.count - 1) * 4 * 60 * 1000 + 60 * 60 * 1000;
  }

  for (const m of spec.missing ?? []) {
    const base = toTime(sy, sm, sd + m.day, m.hour, 0);
    for (let i = 0; i < m.count; i += 1) {
      const t = base + i * 6 * 60 * 1000;
      photos.push({
        id: `${spec.id}-p${photos.length + 1}`,
        name: `IMG_${String(2400 + photos.length).padStart(4, '0')}.JPG`,
        takenAt: t,
        thumb: svgThumb('无定位', `${String(new Date(t).getMonth() + 1).padStart(2, '0')}-${String(new Date(t).getDate()).padStart(2, '0')}`, photos.length),
        locationSource: 'none',
        tripId: spec.id,
      });
    }
  }

  photos.sort((a, b) => a.takenAt - b.takenAt);
  const trip: Trip = {
    id: spec.id,
    title: spec.title,
    startAt: toTime(sy, sm, sd, 0, 0),
    endAt: toTime(ey, em, ed, 23, 59),
    cityNames: spec.cities,
    visits,
    memory: spec.memory,
    createdAt: 0,
  };
  return { trip, photos };
}

export function createDemoTrips(): { trips: Trip[]; photos: Photo[] } {
  const trips: Trip[] = [];
  const photos: Photo[] = [];
  for (const spec of TRIP_SPECS) {
    const built = buildDemoTrip(spec);
    trips.push(built.trip);
    photos.push(...built.photos);
  }
  return { trips, photos };
}

export const DEMO_WISHES: Wish[] = [
  { id: 'w1', name: '冰岛 · 黑沙滩', country: '冰岛', region: '大西洋沿岸', source: '来源：收藏夹 · 2025-08', status: 'wish' },
  { id: 'w2', name: '土耳其 · 卡帕多奇亚', country: '土耳其', region: '安纳托利亚', source: '来源：世界地图推荐', status: 'wish' },
  { id: 'w3', name: '葡萄牙 · 里斯本', country: '葡萄牙', region: '伊比利亚半岛', source: '来源：朋友分享', status: 'wish' },
  { id: 'w4', name: '日本 · 直岛', country: '日本', region: '濑户内海', source: '来源：旅行书单', status: 'wish' },
  { id: 'w5', name: '新西兰 · 皇后镇', country: '新西兰', region: '南岛', source: '来源：收藏夹 · 2025-11', status: 'wish' },
];

export function emptyData(): AppData {
  return {
    version: 1,
    photos: {},
    trips: [],
    candidates: [],
    wishes: DEMO_WISHES.map((w) => ({ ...w })),
    manualVisited: [],
    settings: { rawPhotoLocal: true, cloudSync: false, cityLevelOnly: true },
    config: { ...DEFAULT_CONFIG },
  };
}

export function demoData(): AppData {
  const { trips, photos } = createDemoTrips();
  return {
    ...emptyData(),
    trips,
    photos: Object.fromEntries(photos.map((p) => [p.id, p])),
  };
}

interface ScanSpec {
  id: string;
  start: [number, number, number];
  places: { name: string; day: number; hour: number; count: number; lat: number; lng: number }[];
  missing?: { day: number; hour: number; count: number }[];
}

const SCAN_SPECS: ScanSpec[] = [
  {
    id: 'demo-scan-kyoto',
    start: [2026, 9, 18],
    places: [
      { name: '京都站', day: 0, hour: 13, count: 8, lat: 34.9858, lng: 135.7588 },
      { name: '岚山竹林', day: 1, hour: 10, count: 12, lat: 35.0172, lng: 135.6716 },
      { name: '金阁寺', day: 2, hour: 9, count: 9, lat: 35.0394, lng: 135.7292 },
      { name: '奈良公园', day: 3, hour: 11, count: 13, lat: 34.6851, lng: 135.843 },
    ],
    missing: [{ day: 2, hour: 16, count: 4 }],
  },
  {
    id: 'demo-scan-seoul',
    start: [2026, 6, 12],
    places: [
      { name: '景福宫', day: 0, hour: 10, count: 10, lat: 37.5796, lng: 126.977 },
      { name: '北村韩屋村', day: 1, hour: 11, count: 8, lat: 37.5826, lng: 126.9835 },
      { name: '汉江公园', day: 2, hour: 18, count: 10, lat: 37.5285, lng: 126.9338 },
    ],
  },
  {
    id: 'demo-scan-paris',
    start: [2026, 4, 2],
    places: [
      { name: '埃菲尔铁塔', day: 0, hour: 15, count: 12, lat: 48.8584, lng: 2.2945 },
      { name: '卢浮宫', day: 1, hour: 10, count: 11, lat: 48.8606, lng: 2.3376 },
      { name: '塞纳河', day: 2, hour: 17, count: 9, lat: 48.853, lng: 2.3499 },
      { name: '蒙马特', day: 3, hour: 11, count: 8, lat: 48.8867, lng: 2.3431 },
    ],
  },
  {
    id: 'demo-scan-qingdao',
    start: [2025, 10, 1],
    places: [
      { name: '栈桥', day: 0, hour: 15, count: 9, lat: 36.0611, lng: 120.3167 },
      { name: '小麦岛', day: 1, hour: 10, count: 7, lat: 36.0573, lng: 120.4302 },
      { name: '信号山', day: 2, hour: 16, count: 8, lat: 36.0685, lng: 120.3292 },
    ],
  },
];

/** Synthetic EXIF-like photos used by the "试用示例扫描" button. */
export function createDemoScanPhotos(): Photo[] {
  const photos: Photo[] = [];
  for (const spec of SCAN_SPECS) {
    const [y, m, d] = spec.start;
    for (const p of spec.places) {
      const startAt = toTime(y, m, d + p.day, p.hour, 0);
      for (let i = 0; i < p.count; i += 1) {
        const t = startAt + i * 5 * 60 * 1000;
        photos.push({
          id: `scan-${spec.id}-${photos.length}`,
          name: `EXPORT_${String(1000 + photos.length)}.JPG`,
          takenAt: t,
          lat: p.lat + ((i % 5) - 2) * 0.0008,
          lng: p.lng + ((i % 7) - 3) * 0.0008,
          thumb: svgThumb(p.name, `${String(new Date(t).getMonth() + 1).padStart(2, '0')}-${String(new Date(t).getDate()).padStart(2, '0')}`, photos.length),
          locationSource: 'exif',
          placeLabel: p.name,
        });
      }
    }
    for (const miss of spec.missing ?? []) {
      const base = toTime(y, m, d + miss.day, miss.hour, 0);
      for (let i = 0; i < miss.count; i += 1) {
        photos.push({
          id: `scan-${spec.id}-${photos.length}`,
          name: `EXPORT_${String(1000 + photos.length)}.JPG`,
          takenAt: base + i * 7 * 60 * 1000,
          locationSource: 'none',
        });
      }
    }
  }
  return photos.sort((a, b) => a.takenAt - b.takenAt);
}
