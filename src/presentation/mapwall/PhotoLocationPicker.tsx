import { useState } from "react";
import type { CityRef } from "../../domain/city/city-ref";
import type { Photo } from "../../domain/photo/photo";
import type { LocationSuggestion } from "../../domain/services/fill-locations";
import type { ManualLocationInput } from "./ManualLocationForm";
import type { WaypointDraft } from "./WaypointPanel";
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
  searchCities,
  onPickCity,
  suggestion,
  onUseSuggestion,
}: {
  photos: readonly Photo[];
  draft: WaypointDraft | null;
  onSave: (input: ManualLocationInput) => Promise<void>;
  onCancel: () => void;
  onRepick: () => void;
  load: (id: string) => Promise<Blob | null>;
  searchCities?: ((query: string) => CityRef[]) | undefined;
  onPickCity?: ((city: CityRef) => void) | undefined;
  suggestion?: LocationSuggestion | null | undefined;
  onUseSuggestion?: (() => void) | undefined;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [results, setResults] = useState<CityRef[]>([]);
  const nearby = draft ? nearbyWaypointCity(draft) : null;
  const usingSuggestion =
    !!suggestion &&
    !!draft &&
    Math.abs(draft.lat - suggestion.geo.lat) < 1e-6 &&
    Math.abs(draft.lng - suggestion.geo.lng) < 1e-6;
  const changeQuery = (value: string) => {
    setQuery(value);
    setResults(
      value.trim() && searchCities ? searchCities(value).slice(0, 6) : [],
    );
  };
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
          <small>
            {photos[0]?.fileName}
            {photos.length > 1 ? ` 等 ${photos.length} 张` : ""}
          </small>
        </div>
        <button type="button" disabled={busy} onClick={onCancel}>
          取消，返回照片
        </button>
      </header>
      {photos[0] && (
        <div className="photo-location-preview">
          <ImportedPhotoPreview photo={photos[0]} load={load} />
          <p>
            {usingSuggestion
              ? "图钉是同日照片推断的位置；可直接保存，或点地图修改。"
              : draft
                ? "图钉是你点下的位置。可继续点地图换位置，或改名后确认。"
                : "轻点地图选位置，也可拖动、缩放。只有最后确认才会保存。"}
          </p>
        </div>
      )}
      {suggestion && !usingSuggestion && onUseSuggestion ? (
        <button className="btn ghost wide" type="button" disabled={busy} onClick={onUseSuggestion}>
          使用同日位置：{suggestion.cityRef.name}
        </button>
      ) : null}
      {photos.length > 1 ? (
        <p className="photo-location-context">
          这 {photos.length} 张照片会保存同一个位置。
        </p>
      ) : null}
      {searchCities && onPickCity ? (
        <div className="photo-location-search">
          <label>
            搜索城市
            <input
              aria-label="搜索城市"
              value={query}
              placeholder="例如：巴黎、京都"
              autoComplete="off"
              onChange={(event) => changeQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setQuery("");
                  setResults([]);
                }
              }}
            />
          </label>
          {query.trim() ? (
            <p className="photo-location-context">
              {results.length > 0
                ? "内置城市名；选中后会飞到城市中心，仍可点地图微调。"
                : "没有内置城市匹配；可直接在地图上点选。"}
            </p>
          ) : null}
          {results.length > 0 ? (
            <ul className="photo-location-results" aria-label="城市搜索结果">
              {results.map((city) => (
                <li key={city.key}>
                  <button
                    type="button"
                    onClick={() => {
                      onPickCity(city);
                      setQuery("");
                      setResults([]);
                    }}
                  >
                    <span>{city.name}</span>
                    <small>{city.countryName}</small>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
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
