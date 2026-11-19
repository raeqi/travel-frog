import { useEffect, useRef, useState } from "react";
import { toScreen, type Camera, type Metrics } from "./geometry";
import {
  fetchPois,
  poiArea,
  poiSourceUrl,
  type RealPoi,
  type PoiProvider,
} from "./real-pois";

interface Props {
  onSave?:(point:RealPoi)=>void;
  saveLabel?:string;
  camera: Camera;
  metrics: Metrics;
  mode: "world" | "city" | "region";
  project: (lat: number, lng: number) => { x: number; y: number };
}
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
export function RealPlaces({ camera, metrics, mode, project,onSave,saveLabel }: Props) {
  const [open, setOpen] = useState(false),
    [pois, setPois] = useState<RealPoi[]>([]),
    [selected, setSelected] = useState<RealPoi | null>(null);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [loaded, setLoaded] = useState(false);
  const controller = useRef<AbortController | null>(null),
    lastQuery = useRef(0),
    sequence = useRef(0);
  useEffect(
    () => () => {
      sequence.current++;
      controller.current?.abort();
    },
    [],
  );
  const [provider, setProvider] = useState<PoiProvider>("wikipedia");
  const area = poiArea(camera, metrics, mode);
  async function discover() {
    if (!area || busy) return;
    if (Date.now() - lastQuery.current < 10_000) {
      setMessage("请稍等几秒再查询另一区域");
      return;
    }
    lastQuery.current = Date.now();
    const id = ++sequence.current;
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    setMessage("正在查询地图中心约1.5公里内的景点与公共地点…");
    const timer = window.setTimeout(() => request.abort(), 25_000);
    try {
      const result = await fetchPois(area, request.signal, provider);
      if (sequence.current !== id) return;
      setPois(result);
      setSelected(null);
      setLoaded(true);
      setMessage(
        result.length
          ? `找到 ${result.length} 个${provider === "wikipedia" ? "百科条目" : "地点"} · 名称来自${provider === "wikipedia" ? "Wikipedia" : "OpenStreetMap"}`
          : "这一区域暂无符合条件的命名地点；可移动地图后再查",
      );
    } catch (error) {
      if (sequence.current === id)
        setMessage(
          error instanceof Error && error.name !== "AbortError"
            ? error.message
            : "地点查询超时或已取消，请稍后再试",
        );
    } finally {
      window.clearTimeout(timer);
      if (sequence.current === id) setBusy(false);
    }
  }
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
    <>
      {open ? (
        <div className="real-poi-layer">
          {pins.map(({ poi, screen }) => (
            <button
              key={poi.id}
              className="real-poi-pin"
              type="button"
              style={{ left: screen.x, top: screen.y }}
              onClick={(e) => {
                e.stopPropagation();
                setSelected(poi);
              }}
              aria-label={`地点：${poi.name}`}
            >
              {poi.name}
            </button>
          ))}
        </div>
      ) : null}
      <aside
        className={`real-places${open ? " is-open" : ""}`}
        data-map-controls
        onClick={(e) => e.stopPropagation()}
        aria-label="真实地点"
      >
        <button
          type="button"
          className="real-places-toggle"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? "收起真实地点" : "真实地点"}
        </button>
        {open ? (
          <div className="real-places-body">
            <p>
              手动查找地图中心附近的地名与景点。百科条目可能包含历史地点和事件，OSM补充公共地点；不代表完整商户目录。
            </p>
            <label>
              地点来源{" "}
              <select
                aria-label="地点来源"
                value={provider}
                disabled={busy}
                onChange={(event) => {
                  setProvider(event.target.value as PoiProvider);
                  setPois([]);
                  setSelected(null);
                  setLoaded(false);
                  setMessage("");
                }}
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
            {selected ? (
              <section className="real-place-detail" aria-label="地点详情">
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
                {onSave&&<button type="button" onClick={()=>{onSave(selected);setOpen(false);}}>{saveLabel??'加入旅行清单'}</button>}
                <button type="button" onClick={() => setSelected(null)}>
                  收起详情
                </button>
              </section>
            ) : null}
            {loaded ? (
              <>
                <p>
                  已查询 {pois.length} 个，当前视野 {visible.length}{" "}
                  个；重叠名称可在清单选择。
                </p>
                <div className="real-place-list">
                  {visible.map(({ poi }) => (
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
        ) : null}
      </aside>
    </>
  );
}
