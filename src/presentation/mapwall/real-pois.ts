import {
  CITY_SCALE,
  REGION_SCALE,
  viewRect,
  type Camera,
  type Metrics,
} from "./geometry";

export interface RealPoi {
  readonly id: string;
  readonly lat: number;
  readonly lng: number;
  readonly name: string;
  readonly kind: string;
  readonly tags: Readonly<Record<string, string>>;
}
export interface PoiArea {
  readonly lat: number;
  readonly lng: number;
  readonly radius: number;
}
export function poiArea(
  camera: Camera,
  metrics: Metrics,
  mode: "world" | "city" | "region",
): PoiArea | null {
  const view = viewRect(camera, metrics);
  const lng =
    mode === "city"
      ? 135.7681 + (camera.cx - 500) / CITY_SCALE
      : mode === "region"
        ? 135.55 + (camera.cx - 500) / REGION_SCALE
        : (camera.cx / 1000) * 360 - 180;
  const lat =
    mode === "city"
      ? 35.0116 - (camera.cy - 320) / CITY_SCALE
      : mode === "region"
        ? 34.85 - (camera.cy - 320) / REGION_SCALE
        : 90 - (camera.cy / 640) * 180;
  const degreeWidth =
    mode === "city"
      ? view.viewW / CITY_SCALE
      : mode === "region"
        ? view.viewW / REGION_SCALE
        : (view.viewW / 1000) * 360;
  if (degreeWidth > 0.25 || Math.abs(lat) > 85 || Math.abs(lng) > 180)
    return null;
  // Rounded centre only, never a photo payload or current-device geolocation.
  return {
    lat: Math.round(lat * 1000) / 1000,
    lng: Math.round(lng * 1000) / 1000,
    radius: 1500,
  };
}
export function poiQuery(area: PoiArea): string {
  const { lat, lng, radius } = area;
  if (
    ![lat, lng, radius].every(Number.isFinite) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180 ||
    radius < 1 ||
    radius > 1500
  )
    throw new Error("查询范围无效");
  const around = `(around:${radius},${lat},${lng})`;
  return `[out:json][timeout:20][maxsize:4194304];(nwr${around}[name][tourism~"^(attraction|museum|gallery|viewpoint|zoo|theme_park)$"];nwr${around}[name][historic];nwr${around}[name][amenity~"^(place_of_worship|theatre|arts_centre|library)$"];nwr${around}[name][railway=station];);out center qt 80;`;
}
export function parsePois(data: unknown): RealPoi[] {
  const elements = (data as { elements?: unknown[] } | null)?.elements;
  if (!Array.isArray(elements)) throw new Error("地点服务返回了无法识别的数据");
  const found = new Map<string, RealPoi>();
  for (const value of elements.slice(0, 80)) {
    if (!value || typeof value !== "object") continue;
    const row = value as {
      type?: string;
      id?: number;
      lat?: number;
      lon?: number;
      center?: { lat?: number; lon?: number };
      tags?: Record<string, unknown>;
    };
    if (
      !["node", "way", "relation"].includes(row.type ?? "") ||
      !Number.isSafeInteger(row.id)
    )
      continue;
    const tags = Object.fromEntries(
      Object.entries(row.tags ?? {}).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
    const name = tags["name:zh"] || tags.name || tags["name:en"];
    const lat = row.lat ?? row.center?.lat,
      lng = row.lon ?? row.center?.lon;
    if (
      !name ||
      typeof lat !== "number" ||
      typeof lng !== "number" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180
    )
      continue;
    const id = `${row.type}/${row.id}`;
    found.set(id, {
      id,
      lat,
      lng,
      name,
      kind:
        tags.tourism || tags.historic || tags.amenity || tags.railway || "地点",
      tags,
    });
  }
  return [...found.values()];
}
const cache = new Map<string, { at: number; pois: RealPoi[] }>();
export async function fetchPois(
  area: PoiArea,
  signal: AbortSignal,
): Promise<RealPoi[]> {
  const query = poiQuery(area),
    hit = cache.get(query);
  if (hit && Date.now() - hit.at < 15 * 60_000) return hit.pois;
  const response = await fetch("https://overpass.private.coffee/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ data: query }),
    signal,
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  if (!response.ok)
    throw new Error(
      response.status === 429
        ? "地点服务繁忙，请稍后再试"
        : `地点服务暂不可用（${response.status}）`,
    );
  const pois = parsePois(await response.json());
  if (cache.size >= 12) cache.delete(cache.keys().next().value!);
  cache.set(query, { at: Date.now(), pois });
  return pois;
}
