import { makeCityRef } from '../city/city-ref';

/** Offline story destinations. Coordinates locate the simulation, not a live journey. */
export const FROG_DESTINATIONS = [
  ['金泽', '日本', 'JPN', 36.5613, 136.6562],
  ['首尔', '韩国', 'KOR', 37.5665, 126.978],
  ['会安', '越南', 'VNM', 15.8801, 108.338],
  ['斋浦尔', '印度', 'IND', 26.9124, 75.7873],
  ['库斯科', '秘鲁', 'PER', -13.5319, -71.9675],
  ['开普敦', '南非', 'ZAF', -33.9249, 18.4241],
  ['努克', '格陵兰', 'GRL', 64.1835, -51.7216],
  ['波特兰', '美国', 'USA', 45.5152, -122.6784],
  ['京都', '日本', 'JPN', 35.0116, 135.7681],
  ['上海', '中国', 'CHN', 31.2304, 121.4737],
  ['成都', '中国', 'CHN', 30.5728, 104.0668],
  ['巴黎', '法国', 'FRA', 48.8566, 2.3522],
  ['罗马', '意大利', 'ITA', 41.9028, 12.4964],
  ['雷克雅未克', '冰岛', 'ISL', 64.1466, -21.9426],
].map(([name, countryName, countryCode, lat, lng]) =>
  makeCityRef({
    name: String(name),
    countryName: String(countryName),
    countryCode: String(countryCode),
    centroid: {
      lat: Number(lat),
      lng: Number(lng),
      accuracyM: null,
      source: 'candidate',
      approximate: true,
    },
    source: 'gazetteer',
    confidence: 'high',
  }),
);
