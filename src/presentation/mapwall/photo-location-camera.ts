import {legacyPoint,panMercator} from './mercator-camera';
import {
  projectWorld,
  projectCity,
  projectRegion,
  viewRect,
  type Camera,
  type Metrics,
} from "./geometry";
import { boundCamera, maxMapZoom } from "./map-gestures";

/** Reframe the camera above the phone confirmation card, never change the selected point. */
export function photoLocationCamera(
  point: { lat: number; lng: number },
  camera: Camera,
  metrics: Metrics,
  mode: "world" | "city" | "region",
): Camera {
  if (metrics.sheetW <= 0) return camera;
  if(metrics.mercatorMode){
    const p=legacyPoint(point,mode);
    return panMercator({cx:p.x,cy:p.y,zoom:camera.zoom},0,-metrics.sheetH*.3,metrics,mode);
  }
  const projected = (
    mode === "city"
      ? projectCity
      : mode === "region"
        ? projectRegion
        : projectWorld
  )(point.lat, point.lng);
  const zoom = mode === "world" ? Math.max(camera.zoom, 8) : camera.zoom;
  const view = viewRect({ ...camera, zoom }, metrics),
    k = metrics.sheetW / view.viewW;
  const targetY = Math.max(
    metrics.offY + 32,
    Math.min(metrics.offY + metrics.sheetH * 0.2, metrics.boardH * 0.22),
  );
  return boundCamera(
    {
      cx: projected.x,
      cy: projected.y + view.viewH / 2 - (targetY - metrics.offY) / k,
      zoom,
    },
    metrics,
    maxMapZoom(mode),
  );
}
