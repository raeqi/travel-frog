import { WORLD_COUNTRIES } from "./world";
import type { CityRef } from "../../domain/city/city-ref";
import type { FrogJourney } from "../../domain/frog/journey";
import type { FrogLandscape, FrogRoutePoint } from "../../domain/frog/roaming";
type Point = { lat: number; lng: number };
const countries = WORLD_COUNTRIES.map((c) => ({
  ...c,
  rings: c.d
    .split("M")
    .filter(Boolean)
    .map((r) =>
      [...r.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)].map((m) => ({
        x: Number(m[1]),
        y: Number(m[2]),
      })),
    )
    .filter((r) => r.length > 2),
}));
function inside(
  x: number,
  y: number,
  ring: readonly { x: number; y: number }[],
) {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!,
      b = ring[j]!;
    if (
      a.y > y !== b.y > y &&
      x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x
    )
      hit = !hit;
  }
  return hit;
}
/** Same coarse Natural Earth land geometry as the visible map; not a road or safety map. */
export function landAt(p: Point): { id: string; name: string } | null {
  const x = ((p.lng + 180) / 360) * 1000,
    y = ((90 - p.lat) / 180) * 640;
  for (const c of countries) {
    let land = false;
    for (const ring of c.rings) if (inside(x, y, ring)) land = !land;
    if (land) return { id: c.id, name: c.name };
  }
  return null;
}
function random(seed: number) {
  let x = seed | 0;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}
function seed(text: string) {
  let n = 2166136261;
  for (const c of text) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return n >>> 0 || 1;
}
const wrap = (lng: number) => ((lng + 540) % 360) - 180;
export function randomLandDestination(
  home: CityRef,
  sequence: number,
): CityRef | null {
  const rng = random(seed(`${home.key}:${sequence}`)),
    origin = home.centroid ?? { lat: 35, lng: 105 };
  for (let i = 0; i < 1800; i++) {
    const nearby = sequence % 4 !== 0 && i < 800;
    const p = nearby
      ? {
          lat: Math.max(-60, Math.min(65, origin.lat + (rng() - 0.5) * 12)),
          lng: wrap(origin.lng + (rng() - 0.5) * 18),
        }
      : { lat: -55 + rng() * 120, lng: -180 + rng() * 360 };
    if (Math.hypot(p.lat - origin.lat, p.lng - origin.lng) < 0.2) continue;
    const land = landAt(p);
    if (!land || land.id === "ATA") continue;
    const lat = Number(p.lat.toFixed(6)),
      lng = Number(p.lng.toFixed(6));
    return {
      key: `roam:${sequence}:${lat}:${lng}`,
      name: `${land.name} · 漫游落脚点`,
      countryCode: land.id,
      countryName: land.name,
      centroid: {
        lat,
        lng,
        source: "candidate",
        accuracyM: null,
        approximate: true,
      },
      source: "derived",
      confidence: "low",
    };
  }
  return null;
}
export function landRoamingRoute(j: FrogJourney): readonly FrogRoutePoint[] {
  const from = j.from.centroid,
    dest = j.destination.centroid;
  if (!from || !dest) return [];
  const points: FrogRoutePoint[] = [
    { lat: from.lat, lng: from.lng, at: j.departAt, kind: "transit" },
    { lat: dest.lat, lng: dest.lng, at: j.arriveAt, kind: "transit" },
  ];
  const rng = random(seed(j.id + ":" + j.destination.key));
  let previous: Point = dest;
  const clear = (a: Point, b: Point) =>
    Array.from({ length: 17 }, (_, i) => ({
      lat: a.lat + ((b.lat - a.lat) * i) / 16,
      lng: a.lng + ((b.lng - a.lng) * i) / 16,
    })).every((p) => landAt(p) !== null);
  for (let n = 1; n < 5; n++) {
    let next: Point = previous;
    // Explicit water/island points may be saved, but never invent a walk on water.
    if (landAt(dest))
      for (let i = 0; i < 60; i++) {
        const p = {
          lat: dest.lat + (rng() - 0.5) * 0.035,
          lng: wrap(dest.lng + (rng() - 0.5) * 0.045),
        };
        if (clear(previous, p) && clear(p, dest)) {
          next = p;
          break;
        }
      }
    points.push({
      ...next,
      at: Math.round(j.arriveAt + ((j.returnAt - j.arriveAt) * n) / 5),
      kind: "walk",
    });
    previous = next;
  }
  points.push(
    { lat: dest.lat, lng: dest.lng, at: j.returnAt, kind: "walk" },
    { lat: from.lat, lng: from.lng, at: j.homeAt, kind: "transit" },
  );
  return points;
}
export const OFFLINE_FROG_LANDSCAPE: FrogLandscape = {
  destination: randomLandDestination,
  route: landRoamingRoute,
};
