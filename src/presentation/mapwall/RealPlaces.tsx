import { useEffect, useRef, useState } from "react";
import type { useRealPlaces } from "./useRealPlaces";
import { toScreen, type Camera, type Metrics } from "./geometry";
import {
  poiSourceUrl,
  type RealPoi,
  type PoiProvider,
  type PoiArea,
} from "./real-pois";
const KINDS: Record<string, string> = {
  attraction: "景点",
  museum: "博物馆",
  gallery: "画廊",
  viewpoint: "观景点",
  place_of_worship: "宗教建筑",
  theatre: "剧院",
  library: "图书馆",
  station: "车站",
  monument: "纪念碑",
  memorial: "纪念地",
  castle: "城堡",
  zoo: "动物园",
};
export function RealPlacePins({
  pois,
  camera,
  metrics,
  project,
  onSelect,
}: {
  pois: readonly RealPoi[];
  camera: Camera;
  metrics: Metrics;
  project: (lat: number, lng: number) => { x: number; y: number };
  onSelect: (poi: RealPoi) => void;
}) {
  const visible = pois
    .map((poi) => ({
      poi,
      screen: toScreen(project(poi.lat, poi.lng), camera, metrics),
    }))
    .filter(
      ({ screen: p }) =>
        p.x >= metrics.offX &&
        p.x <= metrics.offX + metrics.sheetW &&
        p.y >= metrics.offY &&
        p.y <= metrics.offY + metrics.sheetH,
    );
  // Greedy label placement bounds DOM and keeps overlapping names in the accessible list.
  const pins: typeof visible = [];
  for (const item of visible)
    if (
      pins.length < 24 &&
      !pins.some(
        (p) =>
          Math.abs(p.screen.x - item.screen.x) < 100 &&
          Math.abs(p.screen.y - item.screen.y) < 28,
      )
    )
      pins.push(item);
  return (
    <div className="real-poi-layer">
      {pins.map(({ poi, screen }) => (
        <button
          key={poi.id}
          className="real-poi-pin"
          type="button"
          style={{ left: screen.x, top: screen.y }}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(poi);
          }}
          aria-label={`地点：${poi.name}`}
        >
          {poi.name}
        </button>
      ))}
    </div>
  );
}
export function RealPlaces({
  places,
  area,
  onSave,
  saveLabel = "添加到蛙蛙目的地",
}: {
  places: ReturnType<typeof useRealPlaces>;
  area: PoiArea | null;
  onSave?: (point: RealPoi) => void;
  saveLabel?: string;
}) {
  const {
    pois,
    selected,
    setSelected,
    busy,
    message,
    loaded,
    provider,
    discover,
    changeProvider,
  } = places;
  const detailRef = useRef<HTMLElement>(null);
  const [filter, setFilter] = useState("");
  useEffect(() => {
    if (selected) detailRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [selected]);
  return (
    <section className="real-places" aria-label="附近真实地点">
      <div className="real-places-body">
        {selected ? (
          <section
            ref={detailRef}
            className="real-place-detail"
            aria-label="地点详情"
          >
            <h3>{selected.name}</h3>
            <p>{KINDS[selected.kind] || selected.kind}</p>
            {selected.tags.name && selected.tags.name !== selected.name ? (
              <p>{selected.tags.name}</p>
            ) : null}
            {selected.tags["addr:full"] ? (
              <p>{selected.tags["addr:full"]}</p>
            ) : null}
            {selected.tags.opening_hours ? (
              <p>地图记录的开放时间：{selected.tags.opening_hours}</p>
            ) : null}
            <p>
              {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}
            </p>
            <a
              href={poiSourceUrl(selected)}
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
            >
              查看来源与完整信息 ↗
            </a>
            {onSave && (
              <button
                type="button"
                onClick={() => {
                  onSave(selected);
                }}
              >
                {saveLabel}
              </button>
            )}
            <button type="button" onClick={() => setSelected(null)}>
              收起详情
            </button>
          </section>
        ) : null}
        <p>
          手动查找地图中心附近的地名与景点。百科条目可能包含历史地点和事件，OSM补充公共地点；不代表完整商户目录。
        </p>
        <label>
          地点来源{" "}
          <select
            aria-label="地点来源"
            value={provider}
            disabled={busy}
            onChange={(event) =>
              changeProvider(event.target.value as PoiProvider)
            }
          >
            <option value="wikipedia">Wikipedia 百科地点</option>
            <option value="osm">OpenStreetMap 公共地点</option>
          </select>
        </label>
        <p className="place-privacy">
          点击查询会把当前地图中心（约100米精度）及IP发送给
          {provider === "wikipedia"
            ? "en.wikipedia.org"
            : "overpass.private.coffee"}
          ；不上传照片，不读取设备定位。
        </p>
        {!area ? <p>请先放大到城市或街区，再查询附近。</p> : null}
        <button
          type="button"
          disabled={!area || busy}
          onClick={() => void discover()}
        >
          {busy ? "查询中…" : "查询当前区域"}
        </button>
        <p role="status">{message}</p>
        {loaded ? (
          <>
            <p>
              已查询 {pois.length}{" "}
              个真实地点；也可以关闭搜索，直接点地图上的名称查看详情。
            </p>
            <label>
              筛选地点名称
              <input
                aria-label="筛选真实地点名称"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </label>
            <div className="real-place-list">
              {pois
                .filter((p) =>
                  p.name
                    .toLocaleLowerCase()
                    .includes(filter.trim().toLocaleLowerCase()),
                )
                .map((poi) => (
                  <button
                    key={poi.id}
                    type="button"
                    onClick={() => setSelected(poi)}
                  >
                    {poi.name}
                  </button>
                ))}
            </div>
          </>
        ) : null}
        <small>
          社区资料可能缺漏或过时，不代表实时营业状态。
          {provider === "wikipedia"
            ? "每次最多50个百科条目"
            : "每次最多80个地点"}
          ，地图最多显示24个名称。
        </small>
        <a
          href={
            provider === "wikipedia"
              ? "https://foundation.wikimedia.org/wiki/Policy:Privacy_policy"
              : "https://overpass.private.coffee/"
          }
          target="_blank"
          rel="noopener noreferrer"
          referrerPolicy="no-referrer"
        >
          查询服务与隐私说明 ↗
        </a>
        <a
          className="osm-credit"
          href={
            provider === "wikipedia"
              ? "https://en.wikipedia.org/wiki/Wikipedia:Copyrights"
              : "https://www.openstreetmap.org/copyright"
          }
          target="_blank"
          rel="noopener noreferrer"
        >
          {provider === "wikipedia"
            ? "来源：Wikipedia · CC BY-SA"
            : "© OpenStreetMap contributors · ODbL"}
        </a>
      </div>
    </section>
  );
}
