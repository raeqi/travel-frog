export interface DetailMapPoint {
  lat: number;
  lng: number;
}
export interface DetailMapView extends DetailMapPoint {
  zoom: number;
}
/** Preserve a real clicked WGS84 point; normal coordinates are never rounded or snapped. */
export function detailMapPoint(point: DetailMapPoint): DetailMapPoint | null {
  if (
    !Number.isFinite(point.lat) ||
    !Number.isFinite(point.lng) ||
    Math.abs(point.lat) > 85.05112878
  )
    return null;
  return {
    lat: point.lat,
    lng:
      point.lng >= -180 && point.lng <= 180
        ? point.lng
        : ((((point.lng + 180) % 360) + 360) % 360) - 180,
  };
}
