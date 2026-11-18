import type { PoiArea, RealPoi } from "./real-pois";

export function wikiQueryUrl(area: PoiArea): string {
  if (
    ![area.lat, area.lng, area.radius].every(Number.isFinite) ||
    Math.abs(area.lat) > 85 ||
    Math.abs(area.lng) > 180 ||
    area.radius < 1 ||
    area.radius > 1500
  )
    throw new Error("查询范围无效");
  const query = new URLSearchParams({
    action: "query",
    generator: "geosearch",
    ggscoord: `${area.lat}|${area.lng}`,
    ggsradius: String(area.radius),
    ggslimit: "50",
    prop: "coordinates|langlinks",
    colimit: "50",
    lllang: "zh",
    lllimit: "50",
    format: "json",
    origin: "*",
  });
  return `https://en.wikipedia.org/w/api.php?${query}`;
}
export function parseWikiPois(data: unknown): RealPoi[] {
  const root = data as {
    batchcomplete?: unknown;
    error?: unknown;
    query?: { pages?: Record<string, unknown> };
  } | null;
  if (!root || root.error || (!root.query && root.batchcomplete === undefined))
    throw new Error("百科服务返回了无法识别的数据");
  const rows = Object.values(root.query?.pages ?? {}),
    result: RealPoi[] = [];
  for (const row of rows.slice(0, 50)) {
    if (!row || typeof row !== "object") continue;
    const p = row as {
      pageid?: number;
      ns?: number;
      title?: string;
      coordinates?: Array<{ lat?: number; lon?: number; globe?: string }>;
      langlinks?: Array<{ lang?: string; "*"?: string }>;
    };
    const coord = p.coordinates?.[0],
      lat = coord?.lat,
      lng = coord?.lon;
    if (
      p.ns !== 0 ||
      !Number.isSafeInteger(p.pageid) ||
      (p.pageid ?? 0) <= 0 ||
      typeof p.title !== "string" ||
      !p.title ||
      coord?.globe !== "earth" ||
      typeof lat !== "number" ||
      typeof lng !== "number" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180
    )
      continue;
    const chinese = p.langlinks?.find((link) => link.lang === "zh")?.["*"];
    result.push({
      id: `wikipedia/${p.pageid}`,
      source: "wikipedia",
      lat,
      lng,
      name: typeof chinese === "string" && chinese ? chinese : p.title,
      kind: "百科地点",
      tags: { name: p.title },
    });
  }
  return result;
}
