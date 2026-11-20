import { useEffect, useRef, useState } from "react";
import { nearbyWaypointCity } from "./waypoint-names";
import type { FrogTravelState } from "../../domain/frog/journey";
import type { TravelWaypoint } from "../../domain/frog/roaming";
export interface WaypointDraft {
  id?: string;
  coordinateEntry?: boolean;
  name: string;
  country: string;
  lat: number;
  lng: number;
  source: "map" | "poi";
}
export function WaypointPanel({
  state,
  open,
  selecting,
  draft,
  onOpen,
  onSelecting,
  onDraft,
  onSave,
  onNext,
  onLocate,
  onRemove,
}: {
  state: FrogTravelState;
  open: boolean;
  selecting: boolean;
  draft: WaypointDraft | null;
  onOpen: (value: boolean) => void;
  onSelecting: (value: boolean) => void;
  onDraft: (value: WaypointDraft | null) => void;
  onSave: (point: WaypointDraft, next: boolean) => Promise<void>;
  onNext: (id: string) => Promise<void>;
  onLocate: (point: TravelWaypoint) => void;
  onRemove: (id: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const run = async (task: () => Promise<void>, success: string) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await task();
      setMessage(success);
    } catch (e) {
      setError(e instanceof Error ? e.message : "没有保存成功，请重试");
    } finally {
      setBusy(false);
    }
  };
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (draft) bodyRef.current?.scrollTo?.({ top: 0 });
  }, [draft]);
  const nearby = draft ? nearbyWaypointCity(draft) : null;
  return (
    <aside
      className={`waypoint-tools${open ? " is-open" : ""}`}
      data-map-controls
      aria-label="蛙蛙目的地"
    >
      <div className="waypoint-toolbar">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => onOpen(!open)}
        >
          蛙蛙目的地 · {state.waypoints?.length ?? 0}
        </button>
      </div>
      {open && (
        <div className="waypoint-body" ref={bodyRef}>
          <header>
            <h2>蛙蛙目的地</h2>
            <button
              type="button"
              aria-label="收起蛙蛙目的地"
              onClick={() => {
                onOpen(false);
                onSelecting(false);
              }}
            >
              ×
            </button>
          </header>
          <button
            type="button"
            className="add-destination"
            onClick={() => {
              onDraft(null);
              onSelecting(true);
            }}
          >
            添加目的地
          </button>
          <p>
            {selecting
              ? "轻点地图选位置，再确认保存；拖动不会添加。"
              : "地点先存清单；设为下一站后，蛙蛙才会按这个方向出发。"}
          </p>
          {draft && (
            <form
              key={`${draft.lat}:${draft.lng}:${draft.name}`}
              aria-label="保存地图选点"
              onSubmit={(e) => {
                e.preventDefault();
                const F = e.currentTarget.ownerDocument.defaultView!.FormData,
                  data = new F(e.currentTarget);
                const next =
                  (e.nativeEvent as SubmitEvent).submitter?.getAttribute(
                    "value",
                  ) === "next";
                const point: WaypointDraft = {
                  ...(draft.id ? { id: draft.id } : {}),
                  name: String(data.get("name") ?? ""),
                  country: String(data.get("country") ?? draft.country),
                  lat: data.has("lat") ? Number(data.get("lat")) : draft.lat,
                  lng: data.has("lng") ? Number(data.get("lng")) : draft.lng,
                  source: draft.source,
                };
                void run(
                  async () => {
                    if (
                      (data.has("lat") && !String(data.get("lat")).trim()) ||
                      (data.has("lng") && !String(data.get("lng")).trim())
                    )
                      throw new Error("请填写有效的位置，0也是有效坐标");
                    await onSave(point, next);
                    onDraft(null);
                    onSelecting(false);
                  },
                  next ? "地点已保存，并设为下一站" : "已保存为候选目的地",
                );
              }}
            >
              <h3>给这个位置取个名字</h3>
              <p className="waypoint-context">
                {draft.coordinateEntry
                  ? "请在高级设置中填写位置。"
                  : nearby
                    ? `这个位置在${nearby.name}附近。`
                    : "已经选好了地图上的位置。"}
                名称可以自由修改，位置会保留在你选的地方。
              </p>
              <fieldset disabled={busy}>
                <label>
                  地点名称
                  <input
                    required
                    name="name"
                    aria-label="目的地名称"
                    maxLength={100}
                    defaultValue={draft.name}
                    placeholder="例如：我想去的海边"
                  />
                </label>
                <details
                  className="waypoint-advanced"
                  open={draft.coordinateEntry || undefined}
                >
                  <summary>高级：调整位置</summary>
                  <p>仅在需要时修改；普通保存和改名不需要填写。</p>
                  <label>
                    国家或地区
                    <input
                      name="country"
                      aria-label="清单国家或地区"
                      maxLength={100}
                      defaultValue={draft.country}
                    />
                  </label>
                  <label>
                    纬度
                    <input
                      name="lat"
                      aria-label="清单纬度"
                      required={draft.coordinateEntry}
                      type="number"
                      min={-90}
                      max={90}
                      step="any"
                      defaultValue={draft.coordinateEntry ? "" : draft.lat}
                    />
                  </label>
                  <label>
                    经度
                    <input
                      name="lng"
                      aria-label="清单经度"
                      required={draft.coordinateEntry}
                      type="number"
                      min={-180}
                      max={180}
                      step="any"
                      defaultValue={draft.coordinateEntry ? "" : draft.lng}
                    />
                  </label>
                </details>
                <div className="waypoint-buttons">
                  <button type="submit" value="save">
                    保存为候选目的地
                  </button>
                  <button type="submit" value="next">
                    保存并设为下一站
                  </button>
                  <button type="button" onClick={() => onDraft(null)}>
                    取消
                  </button>
                </div>
              </fieldset>
            </form>
          )}
          {message && <p role="status">{message}</p>}
          {error && <p role="alert">{error}</p>}
          <ol className="waypoint-list" aria-label="已保存地点">
            {(state.waypoints ?? []).map((p) => (
              <li key={p.id}>
                <strong>{p.name}</strong>
                <span>{p.country}</span>
                <div className="waypoint-buttons">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onLocate(p)}
                  >
                    在地图查看
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () => onNext(p.id),
                        "已设为下一站；可在蛙蛙的旅行里查看和出发",
                      )
                    }
                  >
                    设为下一站
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onDraft({ ...p })}
                  >
                    改名
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () => onRemove(p.id),
                        "已移出清单；已安排的行程仍可在旅行面板撤回",
                      )
                    }
                  >
                    移出清单
                  </button>
                </div>
              </li>
            ))}
          </ol>
          {!state.waypoints?.length && (
            <p>
              清单还是空的。点「添加目的地」后可在地图选任意位置，也可从搜索地点添加。
            </p>
          )}
          <details className="waypoint-advanced">
            <summary>高级定位</summary>
            <button
              type="button"
              onClick={() =>
                onDraft({
                  name: "想去的地方",
                  country: "",
                  lat: 0,
                  lng: 0,
                  source: "map",
                  coordinateEntry: true,
                })
              }
            >
              手动填写经纬度
            </button>
          </details>
          <small>
            设为下一站会替换尚未出发的方向；在途行程先走完。清单不会增加你的真实到访统计，也不会自动发出真实通信。
          </small>
        </div>
      )}
    </aside>
  );
}
