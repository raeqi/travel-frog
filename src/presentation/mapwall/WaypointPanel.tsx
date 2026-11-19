import { useState } from "react";
import type { FrogTravelState } from "../../domain/frog/journey";
import type { TravelWaypoint } from "../../domain/frog/roaming";
export interface WaypointDraft {
  id?: string;
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
  return (
    <aside
      className={`waypoint-tools${open ? " is-open" : ""}`}
      data-map-controls
      aria-label="旅行清单"
    >
      <div className="waypoint-toolbar">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => onOpen(!open)}
        >
          旅行清单 · {state.waypoints?.length ?? 0}
        </button>
        <button
          type="button"
          aria-pressed={selecting}
          onClick={() => {
            onSelecting(!selecting);
            onOpen(true);
          }}
        >
          {" "}
          {selecting ? "完成选点" : "在地图选点"}
        </button>
      </div>
      {open && (
        <div className="waypoint-body">
          <header>
            <h2>想去的地方</h2>
            <button
              type="button"
              aria-label="收起旅行清单"
              onClick={() => {
                onOpen(false);
                onSelecting(false);
              }}
            >
              ×
            </button>
          </header>
          <p>
            {selecting
              ? "轻点地图选位置，再确认保存；拖动不会添加。"
              : "地点先存清单；设为下一站后，蛙蛙才会按这个方向出发。"}
          </p>
          <button
            type="button"
            onClick={() =>
              onDraft({ name: "", country: "", lat: 0, lng: 0, source: "map" })
            }
          >
            直接填写坐标
          </button>
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
                  country: String(data.get("country") ?? ""),
                  lat: Number(data.get("lat")),
                  lng: Number(data.get("lng")),
                  source: draft.source,
                };
                void run(
                  async () => {
                    await onSave(point, next);
                    onDraft(null);
                    onSelecting(false);
                  },
                  next ? "地点已保存，并设为下一站" : "已保存到旅行清单",
                );
              }}
            >
              <h3>给这个位置取个名字</h3>
              <p>
                保留真实坐标，名称可自行填写；无需联网反查。海岸和小岛以你确认的位置为准。
              </p>
              <fieldset disabled={busy}>
                <label>
                  地点名称
                  <input
                    required
                    name="name"
                    aria-label="清单地点名称"
                    maxLength={100}
                    defaultValue={draft.name}
                    placeholder="例如：我想去的海边"
                  />
                </label>
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
                    required
                    type="number"
                    min={-90}
                    max={90}
                    step="any"
                    defaultValue={draft.lat}
                  />
                </label>
                <label>
                  经度
                  <input
                    name="lng"
                    aria-label="清单经度"
                    required
                    type="number"
                    min={-180}
                    max={180}
                    step="any"
                    defaultValue={draft.lng}
                  />
                </label>
                <div className="waypoint-buttons">
                  <button type="submit" value="save">
                    保存到旅行清单
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
                <span>
                  {p.country} · {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                </span>
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
                    改名或坐标
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
            <p>清单还是空的。可在地图点任意位置，或从真实地点详情添加。</p>
          )}
          <small>
            设为下一站会替换尚未出发的方向；在途行程先走完。清单不会增加你的真实到访统计，也不会自动发出真实通信。
          </small>
        </div>
      )}
    </aside>
  );
}
