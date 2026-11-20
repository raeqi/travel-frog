import { useState,type ReactNode } from "react";
import type { Photo } from "../../domain/photo/photo";
import type { ManualLocationInput } from "./ManualLocationForm";
import type { WaypointDraft } from "./WaypointPanel";
import { GazetteerCityResolver } from "../../infrastructure/geo/city-resolver";
const cityNames = new GazetteerCityResolver();
import { nearbyWaypointCity } from "./waypoint-names";
import { ImportedPhotoPreview } from "./RepairPhotos";
import "./photo-location-picker.css";

export function PhotoLocationPicker({
  photos,
  draft,
  onSave,
  onCancel,
  onRepick,
  load,
  detailedMap = false,
  onDetailedMap,
  referenceLabel = null,
  onSearchPlace,
  mapControls,
}: {
  mapControls?:ReactNode;
  detailedMap?: boolean;
  onDetailedMap?: () => void;
  referenceLabel?: string | null;
  onSearchPlace?: (point: { name: string; lat: number; lng: number }) => void;
  photos: readonly Photo[];
  draft: WaypointDraft | null;
  onSave: (input: ManualLocationInput) => Promise<void>;
  onCancel: () => void;
  onRepick: () => void;
  load: (id: string) => Promise<Blob | null>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const nearby = draft ? nearbyWaypointCity(draft) : null;
  const matches = query.trim()
    ? cityNames.suggest(query, 5).filter((c) => c.centroid)
    : [];
  return (
    <section
      className="photo-location-picker"
      aria-label="给照片在地图选位置"
      data-map-controls
      data-photo-ids={photos.map((p) => p.id).join(",")}
    >
      <header>
        <div>
          <strong>给 {photos.length} 张照片选位置</strong>
          <small>{photos[0]?.fileName}</small>
        </div>
        <button type="button" disabled={busy} onClick={onCancel}>
          取消，返回照片
        </button>
      </header>
      {photos[0] && (
        <div className="photo-location-preview">
          <ImportedPhotoPreview photo={photos[0]} load={load} />
          <p>
            {draft
              ? "图钉是你点下的位置。可继续点地图换位置，或改名后确认。"
              : "轻点地图选位置，也可拖动、缩放。只有最后确认才会保存。"}
          </p>
        </div>
      )}
      {!draft && (
        <>
          {referenceLabel && (
            <p className="photo-reference">
              当前参考：{referenceLabel}
              。这只是起始视野，请在地图上确认准确位置。
            </p>
          )}
          {onSearchPlace && (
            <div className="photo-place-search">
              <label>
                搜索城市
                <input
                  aria-label="搜索照片拍摄城市"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="例如：京都"
                />
              </label>
              {matches.length > 0 && (
                <ul aria-label="照片城市建议">
                  {matches.map((c) => (
                    <li key={c.key}>
                      <button
                        type="button"
                        onClick={() => {
                          onSearchPlace({
                            name: c.name,
                            lat: c.centroid!.lat,
                            lng: c.centroid!.lng,
                          });
                          setQuery("");
                        }}
                      >
                        查看{c.name}附近 · {c.countryName}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
      {!detailedMap && onDetailedMap && (
        <details className="photo-street-optin">
          <summary>使用街道底图 · 本地试验</summary>
          <p>
            会向 OpenStreetMap 请求当前视野的底图；服务会接收 IP
            和瓦片范围，不发送照片或文件名。地名采用当地语言，尚非全中文。
          </p>
          <button type="button" onClick={onDetailedMap}>
            启用街道底图
          </button>
        </details>
      )}
      {mapControls}
      {draft ? (
        <form
          key={`${draft.lat}:${draft.lng}:${draft.name}`}
          aria-label="确认照片位置"
          onSubmit={(e) => {
            e.preventDefault();
            const F = e.currentTarget.ownerDocument.defaultView!.FormData,
              data = new F(e.currentTarget);
            const input = {
              name: String(data.get("name") ?? ""),
              country: String(data.get("country") ?? draft.country),
              lat: Number(data.get("lat") ?? draft.lat),
              lng: Number(data.get("lng") ?? draft.lng),
            };
            setBusy(true);
            setError("");
            void onSave(input)
              .catch((e) =>
                setError(
                  e instanceof Error ? e.message : "位置没有保存，请重试",
                ),
              )
              .finally(() => setBusy(false));
          }}
        >
          <fieldset disabled={busy}>
            <label>
              地点名
              <input
                name="name"
                aria-label="照片地点名"
                required
                maxLength={100}
                defaultValue={draft.name}
              />
            </label>
            <p className="photo-location-context">
              {nearby
                ? `${nearby.name}附近，仅作名称建议。`
                : "没有附近城市也能保存。"}{" "}
              名称可自定义，位置不会吸附到城市中心。
            </p>
            <div className="photo-location-buttons">
              <button type="submit" className="btn primary">
                {busy ? "保存中…" : "保存位置并继续"}
              </button>
              <button type="button" className="btn ghost" onClick={onRepick}>
                重新选点
              </button>
            </div>
            <details>
              <summary>高级：调整位置</summary>
              <label>
                国家或地区
                <input
                  name="country"
                  maxLength={100}
                  defaultValue={draft.country}
                />
              </label>
              <label>
                纬度
                <input
                  name="lat"
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
                  required
                  type="number"
                  min={-180}
                  max={180}
                  step="any"
                  defaultValue={draft.lng}
                />
              </label>
            </details>
          </fieldset>
        </form>
      ) : (
        <p className="photo-location-waiting" role="status">
          请先在地图轻点一个位置
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
