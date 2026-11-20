import type { RefObject } from "react";
import type { PoiGroups } from "./groups";

export interface PoiListProps {
  readonly groups: PoiGroups;
  readonly total: number;
  readonly open: boolean;
  readonly linked: boolean;
  readonly highlightCity: string | null;
  readonly highlightWish: string | null;
  readonly homeCityName: string;
  readonly scrollRef: RefObject<HTMLDivElement | null>;
  readonly imageForPhoto: (photoId: string) => string | null;
  readonly onToggle: () => void;
  readonly onCity: (cityKey: string) => void;
  readonly onWish: (wishId: string) => void;
  readonly onHome: () => void;
  readonly onScroll: () => void;
}

const MENU_ICON = (
  <svg
    viewBox="0 0 20 20"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
  >
    <path d="M4 5.2h12M4 10h12M4 14.8h12" />
    <circle cx="2.2" cy="5.2" r=".8" fill="currentColor" stroke="none" />
    <circle cx="2.2" cy="10" r=".8" fill="currentColor" stroke="none" />
    <circle cx="2.2" cy="14.8" r=".8" fill="currentColor" stroke="none" />
  </svg>
);

export function PoiList({
  groups,
  total,
  open,
  linked,
  highlightCity,
  highlightWish,
  scrollRef,
  imageForPhoto,
  onToggle,
  onCity,
  onWish,
  onScroll,
}: PoiListProps) {
  return (
    <aside
      className={`poi-list${open ? " is-open" : ""}${linked ? " is-linked" : ""}`}
      aria-label="点位清单"
    >
      <button
        className="poi-toggle"
        type="button"
        aria-expanded={open}
        aria-controls="poiContents"
        aria-label={open ? "收起足迹与愿望列表" : "展开足迹与愿望列表"}
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
      >
        {MENU_ICON}
        <span>足迹 / 还想去</span>
        <em>{total} 处</em>
        <b>{open ? "收起" : "展开"}</b>
      </button>
      <div className="poi-body" id="poiContents" hidden={!open} inert={!open}>
        <div
          className="poi-scroll"
          id="poiScroll"
          ref={scrollRef}
          onScroll={onScroll}
          tabIndex={0}
          role="region"
          aria-label="足迹与愿望列表内容"
        >
          <header className="poi-head">
            <span>足迹</span>
          </header>
          {groups.years.length === 0 && (
            <p className="poi-empty">还没有照片足迹。</p>
          )}
          {groups.years.map((group) => (
            <div key={group.year}>
              <div className="poi-year">{group.year}</div>
              {group.rows.map((row) => {
                const image = imageForPhoto(row.photoId);
                return (
                  <button
                    key={`${group.year}-${row.cityKey}`}
                    type="button"
                    className={`poi-row${highlightCity === row.cityKey ? " is-hl" : ""}`}
                    data-city={row.cityKey}
                    data-year={group.year}
                    onClick={(event) => {
                      event.stopPropagation();
                      onCity(row.cityKey);
                    }}
                  >
                    <span
                      className="poi-thumb"
                      style={
                        image
                          ? { backgroundImage: `url("${image}")` }
                          : undefined
                      }
                    />
                    <span className="poi-name">{row.name}</span>
                    <span className="poi-meta">
                      {group.year} · {row.count} 张
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
          {groups.wished.length > 0 && (
            <div className="poi-wish-block">
              <div className="poi-sub">
                还想去 <i>{groups.wished.length}</i>
              </div>
              {groups.wished.map((wish) => (
                <button
                  key={wish.id}
                  type="button"
                  className={`poi-row poi-wish-row${highlightWish === wish.id ? " is-hl" : ""}`}
                  data-wish={wish.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    onWish(wish.id);
                  }}
                >
                  <span className="poi-thumb poi-wish-thumb" />
                  <span className="poi-name">{wish.name}</span>
                  <span className="poi-mark">寄</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
