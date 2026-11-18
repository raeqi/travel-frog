import { domainError, err, ok, type Result } from '../common/result';

export type LocationSource = 'exif' | 'candidate' | 'manual' | 'none';

export interface GeoPoint {
  readonly lat: number;
  readonly lng: number;
  readonly accuracyM: number | null;
  readonly source: Exclude<LocationSource, 'none'>;
  /** True when the coordinate is inferred rather than read from EXIF or entered by the user. */
  readonly approximate: boolean;
}

export function makeGeoPoint(input: {
  lat: number;
  lng: number;
  source: Exclude<LocationSource, 'none'>;
  approximate: boolean;
  accuracyM?: number | null;
}): Result<GeoPoint> {
  const { lat, lng, source } = input;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return err(domainError('GEO_INVALID', '坐标超出有效范围'));
  }
  if (lat === 0 && lng === 0 && source !== 'manual') {
    return err(domainError('GEO_INVALID', '空坐标 (0,0) 不是有效位置'));
  }
  const accuracy = input.accuracyM ?? null;
  if (accuracy !== null && (!Number.isFinite(accuracy) || accuracy < 0)) {
    return err(domainError('GEO_INVALID', '精度必须是非负数'));
  }
  return ok({ lat, lng, accuracyM: accuracy, source, approximate: input.approximate });
}

export function geoEquals(a: GeoPoint, b: GeoPoint): boolean {
  return Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lng - b.lng) < 1e-6;
}

const EARTH_RADIUS_KM = 6371;

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface Centroid {
  lat: number;
  lng: number;
}

export function centroidOf(points: readonly Centroid[]): Centroid | null {
  if (points.length === 0) return null;
  let lat = 0;
  let lng = 0;
  for (const point of points) {
    lat += point.lat;
    lng += point.lng;
  }
  return { lat: lat / points.length, lng: lng / points.length };
}

/** Approximate timezone offset from longitude, used only as an explicit fallback. */
export function offsetFromLongitude(lng: number): number {
  const hours = Math.round(lng / 15);
  const clamped = Math.max(-12, Math.min(14, hours));
  return clamped * 60;
}
