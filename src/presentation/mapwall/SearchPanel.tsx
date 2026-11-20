import { useEffect, useRef, useState, type ReactNode } from "react";
import { GazetteerCityResolver } from "../../infrastructure/geo/city-resolver";
import type { WaypointDraft } from "./WaypointPanel";

export type SearchKind = "trip" | "city" | "wish";
export type PlaceSearchTab = "archive" | "real";
export interface SearchItem {
  readonly id: string;
  readonly kind: SearchKind;
  readonly title: string;
  readonly subtitle: string;
  readonly go: string;
  readonly destination?: WaypointDraft;
}
const cityNames = new GazetteerCityResolver();
const GROUP_LABELS: Record<SearchKind, string> = {
  trip: "我的旅行",
  city: "照片足迹",
  wish: "愿望与来信",
};
export interface SearchPanelProps {
  readonly open: boolean;
  readonly items: readonly SearchItem[];
  readonly tab: PlaceSearchTab;
  readonly onTab: (tab: PlaceSearchTab) => void;
  readonly realPlaces: ReactNode;
  readonly onClose: () => void;
  readonly onPick: (item: SearchItem) => void;
  readonly onDestination: (point: WaypointDraft) => void;
  readonly onLocate: (point: WaypointDraft) => void;
}
export function SearchPanel({
  open,
  items,
  tab,
  onTab,
  realPlaces,
  onClose,
  onPick,
  onDestination,
  onLocate,
}: SearchPanelProps) {
  const [query, setQuery] = useState(""),
    [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [open]);
  if (!open) return null;
  const needle = query.trim().toLocaleLowerCase(),
    matches = needle
      ? items.filter(
          (item) =>
            item.title.toLocaleLowerCase().includes(needle) ||
            item.subtitle.toLocaleLowerCase().includes(needle),
        )
      : items;
  const cities = needle
    ? cityNames.suggest(query, 8).filter((city) => city.centroid)
    : [];
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <section className="palette place-search" aria-label="搜索地点">
        <header className="place-search-head">
          <h2>搜索地点</h2>
          <button type="button" aria-label="关闭搜索地点" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="tabs" role="tablist" aria-label="地点来源">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "archive"}
            onClick={() => onTab("archive")}
          >
            城市与我的档案
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "real"}
            onClick={() => onTab("real")}
          >
            附近真实地点
          </button>
        </div>
        {tab === "real" ? (
          <div className="palette-body">{realPlaces}</div>
        ) : (
          <>
            <div className="palette-input">
              <input
                ref={inputRef}
                aria-label="搜索城市与档案"
                value={query}
                placeholder="城市、年份或一句话记忆"
                autoComplete="off"
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive(
                      (i) =>
                        (i +
                          (e.key === "ArrowDown" ? 1 : -1) +
                          matches.length) %
                        Math.max(1, matches.length),
                    );
                  }
                  if (
                    e.key === "Enter" &&
                    matches[Math.min(active, matches.length - 1)]
                  )
                    onPick(matches[Math.min(active, matches.length - 1)]!);
                }}
              />
            </div>
            <div className="palette-body">
              {cities.length > 0 && (
                <section aria-label="离线城市建议">
                  <p className="palette-group">
                    城市建议 · 离线地名，非到访记录
                  </p>
                  {cities.map((city) => {
                    const point: WaypointDraft = {
                      name: city.name,
                      country: city.countryName,
                      lat: city.centroid!.lat,
                      lng: city.centroid!.lng,
                      source: "map",
                    };
                    return (
                      <div className="place-search-result" key={city.key}>
                        <button
                          className="presult"
                          type="button"
                          onClick={() => onLocate(point)}
                        >
                          <span>
                            <strong>{city.name}</strong>
                            <em>{city.countryName} · 查看城市附近</em>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDestination(point)}
                        >
                          添加到蛙蛙目的地
                        </button>
                      </div>
                    );
                  })}
                </section>
              )}
              {matches.length === 0 && cities.length === 0 && (
                <p className="palette-group">
                  没有匹配项；仍可在「蛙蛙目的地」中添加任意地图位置。
                </p>
              )}
              {(["trip", "city", "wish"] as const).map((kind) => {
                const found = matches.filter((item) => item.kind === kind);
                return found.length ? (
                  <section key={kind}>
                    <p className="palette-group">{GROUP_LABELS[kind]}</p>
                    {found.map((item) => (
                      <div className="place-search-result" key={item.id}>
                        <button
                          className={`presult${matches.indexOf(item) === active ? " is-active" : ""}`}
                          type="button"
                          onClick={() => onPick(item)}
                        >
                          <span>
                            <strong>{item.title}</strong>
                            <em>{item.subtitle}</em>
                          </span>
                          <span className="go">{item.go}</span>
                        </button>
                        {item.destination && (
                          <button
                            type="button"
                            onClick={() => onDestination(item.destination!)}
                          >
                            添加到蛙蛙目的地
                          </button>
                        )}
                      </div>
                    ))}
                  </section>
                ) : null;
              })}
            </div>
          </>
        )}
      </section>
    </>
  );
}
