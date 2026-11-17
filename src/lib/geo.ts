import type { CityHit } from '../types';

export interface CityDef {
  city: string;
  country: string;
  code: string;
  lat: number;
  lng: number;
}

/** Offline gazetteer used to turn GPS into city-level labels. No network calls. */
export const CITIES: CityDef[] = [
  { city: '北京', country: '中国', code: 'CHN', lat: 39.9042, lng: 116.4074 },
  { city: '上海', country: '中国', code: 'CHN', lat: 31.2304, lng: 121.4737 },
  { city: '杭州', country: '中国', code: 'CHN', lat: 30.2741, lng: 120.1551 },
  { city: '成都', country: '中国', code: 'CHN', lat: 30.5728, lng: 104.0668 },
  { city: '重庆', country: '中国', code: 'CHN', lat: 29.563, lng: 106.5516 },
  { city: '青岛', country: '中国', code: 'CHN', lat: 36.0671, lng: 120.3826 },
  { city: '哈尔滨', country: '中国', code: 'CHN', lat: 45.8038, lng: 126.535 },
  { city: '广州', country: '中国', code: 'CHN', lat: 23.1291, lng: 113.2644 },
  { city: '深圳', country: '中国', code: 'CHN', lat: 22.5431, lng: 114.0579 },
  { city: '西安', country: '中国', code: 'CHN', lat: 34.3416, lng: 108.9398 },
  { city: '南京', country: '中国', code: 'CHN', lat: 32.0603, lng: 118.7969 },
  { city: '苏州', country: '中国', code: 'CHN', lat: 31.2989, lng: 120.5853 },
  { city: '厦门', country: '中国', code: 'CHN', lat: 24.4798, lng: 118.0894 },
  { city: '昆明', country: '中国', code: 'CHN', lat: 25.0389, lng: 102.7183 },
  { city: '拉萨', country: '中国', code: 'CHN', lat: 29.652, lng: 91.1721 },
  { city: '乌鲁木齐', country: '中国', code: 'CHN', lat: 43.8256, lng: 87.6168 },
  { city: '香港', country: '中国', code: 'CHN', lat: 22.3193, lng: 114.1694 },
  { city: '澳门', country: '中国', code: 'CHN', lat: 22.1987, lng: 113.5439 },
  { city: '台北', country: '中国', code: 'TWN', lat: 25.033, lng: 121.5654 },
  { city: '东京', country: '日本', code: 'JPN', lat: 35.6762, lng: 139.6503 },
  { city: '京都', country: '日本', code: 'JPN', lat: 35.0116, lng: 135.7681 },
  { city: '大阪', country: '日本', code: 'JPN', lat: 34.6937, lng: 135.5023 },
  { city: '札幌', country: '日本', code: 'JPN', lat: 43.0618, lng: 141.3545 },
  { city: '福冈', country: '日本', code: 'JPN', lat: 33.5904, lng: 130.4017 },
  { city: '名古屋', country: '日本', code: 'JPN', lat: 35.1815, lng: 136.9066 },
  { city: '冲绳', country: '日本', code: 'JPN', lat: 26.3344, lng: 127.8056 },
  { city: '奈良', country: '日本', code: 'JPN', lat: 34.6851, lng: 135.8048 },
  { city: '神户', country: '日本', code: 'JPN', lat: 34.6901, lng: 135.1955 },
  { city: '横滨', country: '日本', code: 'JPN', lat: 35.4437, lng: 139.638 },
  { city: '首尔', country: '韩国', code: 'KOR', lat: 37.5665, lng: 126.978 },
  { city: '釜山', country: '韩国', code: 'KOR', lat: 35.1796, lng: 129.0756 },
  { city: '济州', country: '韩国', code: 'KOR', lat: 33.4996, lng: 126.5312 },
  { city: '曼谷', country: '泰国', code: 'THA', lat: 13.7563, lng: 100.5018 },
  { city: '清迈', country: '泰国', code: 'THA', lat: 18.7883, lng: 98.9853 },
  { city: '普吉', country: '泰国', code: 'THA', lat: 7.8804, lng: 98.3923 },
  { city: '新加坡', country: '新加坡', code: 'SGP', lat: 1.3521, lng: 103.8198 },
  { city: '吉隆坡', country: '马来西亚', code: 'MYS', lat: 3.139, lng: 101.6869 },
  { city: '河内', country: '越南', code: 'VNM', lat: 21.0278, lng: 105.8342 },
  { city: '胡志明市', country: '越南', code: 'VNM', lat: 10.8231, lng: 106.6297 },
  { city: '巴厘岛', country: '印度尼西亚', code: 'IDN', lat: -8.4095, lng: 115.1889 },
  { city: '马尼拉', country: '菲律宾', code: 'PHL', lat: 14.5995, lng: 120.9842 },
  { city: '新德里', country: '印度', code: 'IND', lat: 28.6139, lng: 77.209 },
  { city: '孟买', country: '印度', code: 'IND', lat: 19.076, lng: 72.8777 },
  { city: '加德满都', country: '尼泊尔', code: 'NPL', lat: 27.7172, lng: 85.324 },
  { city: '伊斯坦布尔', country: '土耳其', code: 'TUR', lat: 41.0082, lng: 28.9784 },
  { city: '卡帕多奇亚', country: '土耳其', code: 'TUR', lat: 38.6431, lng: 34.8289 },
  { city: '迪拜', country: '阿联酋', code: 'ARE', lat: 25.2048, lng: 55.2708 },
  { city: '巴黎', country: '法国', code: 'FRA', lat: 48.8566, lng: 2.3522 },
  { city: '罗马', country: '意大利', code: 'ITA', lat: 41.9028, lng: 12.4964 },
  { city: '威尼斯', country: '意大利', code: 'ITA', lat: 45.4408, lng: 12.3155 },
  { city: '米兰', country: '意大利', code: 'ITA', lat: 45.4642, lng: 9.19 },
  { city: '佛罗伦萨', country: '意大利', code: 'ITA', lat: 43.7696, lng: 11.2558 },
  { city: '伦敦', country: '英国', code: 'GBR', lat: 51.5074, lng: -0.1278 },
  { city: '柏林', country: '德国', code: 'DEU', lat: 52.52, lng: 13.405 },
  { city: '慕尼黑', country: '德国', code: 'DEU', lat: 48.1351, lng: 11.582 },
  { city: '巴塞罗那', country: '西班牙', code: 'ESP', lat: 41.3874, lng: 2.1686 },
  { city: '马德里', country: '西班牙', code: 'ESP', lat: 40.4168, lng: -3.7038 },
  { city: '阿姆斯特丹', country: '荷兰', code: 'NLD', lat: 52.3676, lng: 4.9041 },
  { city: '布拉格', country: '捷克', code: 'CZE', lat: 50.0755, lng: 14.4378 },
  { city: '维也纳', country: '奥地利', code: 'AUT', lat: 48.2082, lng: 16.3738 },
  { city: '苏黎世', country: '瑞士', code: 'CHE', lat: 47.3769, lng: 8.5417 },
  { city: '日内瓦', country: '瑞士', code: 'CHE', lat: 46.2044, lng: 6.1432 },
  { city: '里斯本', country: '葡萄牙', code: 'PRT', lat: 38.7223, lng: -9.1393 },
  { city: '波尔图', country: '葡萄牙', code: 'PRT', lat: 41.1579, lng: -8.6291 },
  { city: '雷克雅未克', country: '冰岛', code: 'ISL', lat: 64.1466, lng: -21.9426 },
  { city: '斯德哥尔摩', country: '瑞典', code: 'SWE', lat: 59.3293, lng: 18.0686 },
  { city: '哥本哈根', country: '丹麦', code: 'DNK', lat: 55.6761, lng: 12.5683 },
  { city: '奥斯陆', country: '挪威', code: 'NOR', lat: 59.9139, lng: 10.7522 },
  { city: '赫尔辛基', country: '芬兰', code: 'FIN', lat: 60.1699, lng: 24.9384 },
  { city: '雅典', country: '希腊', code: 'GRC', lat: 37.9838, lng: 23.7275 },
  { city: '布达佩斯', country: '匈牙利', code: 'HUN', lat: 47.4979, lng: 19.0402 },
  { city: '布鲁塞尔', country: '比利时', code: 'BEL', lat: 50.8503, lng: 4.3517 },
  { city: '纽约', country: '美国', code: 'USA', lat: 40.7128, lng: -74.006 },
  { city: '旧金山', country: '美国', code: 'USA', lat: 37.7749, lng: -122.4194 },
  { city: '洛杉矶', country: '美国', code: 'USA', lat: 34.0522, lng: -118.2437 },
  { city: '西雅图', country: '美国', code: 'USA', lat: 47.6062, lng: -122.3321 },
  { city: '温哥华', country: '加拿大', code: 'CAN', lat: 49.2827, lng: -123.1207 },
  { city: '多伦多', country: '加拿大', code: 'CAN', lat: 43.6532, lng: -79.3832 },
  { city: '墨西哥城', country: '墨西哥', code: 'MEX', lat: 19.4326, lng: -99.1332 },
  { city: '里约热内卢', country: '巴西', code: 'BRA', lat: -22.9068, lng: -43.1729 },
  { city: '布宜诺斯艾利斯', country: '阿根廷', code: 'ARG', lat: -34.6037, lng: -58.3816 },
  { city: '利马', country: '秘鲁', code: 'PER', lat: -12.0464, lng: -77.0428 },
  { city: '圣地亚哥', country: '智利', code: 'CHL', lat: -33.4489, lng: -70.6693 },
  { city: '悉尼', country: '澳大利亚', code: 'AUS', lat: -33.8688, lng: 151.2093 },
  { city: '墨尔本', country: '澳大利亚', code: 'AUS', lat: -37.8136, lng: 144.9631 },
  { city: '奥克兰', country: '新西兰', code: 'NZL', lat: -36.8485, lng: 174.7633 },
  { city: '皇后镇', country: '新西兰', code: 'NZL', lat: -45.0312, lng: 168.6626 },
  { city: '开罗', country: '埃及', code: 'EGY', lat: 30.0444, lng: 31.2357 },
  { city: '开普敦', country: '南非', code: 'ZAF', lat: -33.9249, lng: 18.4241 },
  { city: '马拉喀什', country: '摩洛哥', code: 'MAR', lat: 31.6295, lng: -7.9811 },
  { city: '内罗毕', country: '肯尼亚', code: 'KEN', lat: -1.2921, lng: 36.8219 },
];

export function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function nearestCity(lat: number, lng: number, maxKm = 120): CityHit | null {
  let best: CityHit | null = null;
  for (const c of CITIES) {
    const distanceKm = haversineKm(lat, lng, c.lat, c.lng);
    if (!best || distanceKm < best.distanceKm) {
      best = { city: c.city, country: c.country, countryCode: c.code, lat: c.lat, lng: c.lng, distanceKm };
    }
  }
  if (!best || best.distanceKm > maxKm) return null;
  return best;
}

export function placeLabel(lat: number, lng: number, explicit?: string): string {
  if (explicit) return explicit;
  const hit = nearestCity(lat, lng);
  return hit ? hit.city : '未识别地点';
}

export function cityName(lat: number, lng: number, explicit?: string): string {
  if (explicit) return explicit;
  const hit = nearestCity(lat, lng);
  return hit ? hit.city : '未识别地点';
}

export function countryName(lat: number, lng: number): string {
  const hit = nearestCity(lat, lng);
  return hit ? hit.country : '—';
}

export function countryCode(lat: number, lng: number): string | null {
  const hit = nearestCity(lat, lng);
  return hit ? hit.countryCode : null;
}

/** Equirectangular projection shared by every map in the app (1000 x 640 viewBox). */
export function project(lat: number, lng: number): { x: number; y: number } {
  return {
    x: ((lng + 180) / 360) * 1000,
    y: ((90 - lat) / 180) * 640,
  };
}

export function formatCoord(lat: number, lng: number): string {
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

export function timezoneOffsetFor(lng: number): number {
  return Math.round(lng / 15);
}
