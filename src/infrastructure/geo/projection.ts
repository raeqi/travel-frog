/** Equirectangular projection onto the bundled 1000×640 world viewBox. */
export const WORLD_WIDTH = 1000;
export const WORLD_HEIGHT = 640;

export function project(lat: number, lng: number): { x: number; y: number } {
  return {
    x: ((lng + 180) / 360) * WORLD_WIDTH,
    y: ((90 - lat) / 180) * WORLD_HEIGHT,
  };
}

export function unproject(x: number, y: number): { lat: number; lng: number } {
  return {
    lng: (x / WORLD_WIDTH) * 360 - 180,
    lat: 90 - (y / WORLD_HEIGHT) * 180,
  };
}
