import { projectWorld, type Camera } from "./geometry";

/** Fit actual coordinates, without borrowing Kyoto streets for unrelated cities. */
export function cityCamera(
  photos: readonly { lat: number; lng: number }[],
  center: { lat: number; lng: number },
  aspect: number,
): Camera {
  const points = (photos.length ? photos : [center]).map((p) =>
    projectWorld(p.lat, p.lng),
  );
  const xs = points.map((p) => p.x),
    ys = points.map((p) => p.y);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const zoom = Math.min(
    12000,
    Math.max(
      28,
      Math.min(
        (1000 * 0.68) / Math.max(0.06, maxX - minX),
        (1000 * aspect * 0.62) / Math.max(0.06, maxY - minY),
      ),
    ),
  );
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, zoom };
}
