import { useEffect, useRef, useState } from "react";
import {
  fetchPois,
  type PoiArea,
  type RealPoi,
  type PoiProvider,
} from "./real-pois";
export function useRealPlaces(area: PoiArea | null) {
  const [pois, setPois] = useState<RealPoi[]>([]),
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
  return {
    pois,
    selected,
    setSelected,
    busy,
    message,
    loaded,
    provider,
    discover,
    changeProvider(value: PoiProvider) {
      setProvider(value);
      setPois([]);
      setSelected(null);
      setLoaded(false);
      setMessage("");
    },
  };
}
