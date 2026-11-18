import { lazy, Suspense, useState, type CSSProperties } from "react";
import type { HomeState } from "../../domain/home/home";
import {
  curioSlots,
  LUGGAGE_LABELS,
  type FurnitureState,
  type LuggageTier,
  type SpecialtyAward,
} from "../../domain/home/collection";
import {
  PERCH_LABELS,
  perchForDisplay,
  type FrogPerch,
  type HomeDisplay,
} from "../../domain/home/perch";
import { wishStatusLabel, type WishStatus } from "../../domain/wish/wish";
import { FrogPerchFigure } from "./Frog";
import { FROG_POSE_LABELS } from "./frog-poses";
import { ROOM_FLOOR } from "./room-navigation";
import { useRoomFrog } from "./useRoomFrog";

const SpatialRoom = lazy(() => import("./SpatialRoom"));

export interface HomePostcard {
  readonly id: string;
  readonly name: string;
  readonly status: WishStatus;
  readonly year: number;
}
export interface HomeRoomProps {
  readonly home: HomeState;
  readonly furniture: FurnitureState;
  readonly luggage: LuggageTier;
  readonly postcards: readonly HomePostcard[];
  readonly onPerch: (perch: FrogPerch) => void;
  readonly onMap: () => void;
  readonly onSpecialty: (award: SpecialtyAward) => void;
  readonly onPostcard: (wishId: string) => void;
  readonly onMoveHome: (cityName: string) => Promise<boolean>;
}

function souvenirIndex(name: string, slot: number): number {
  if (name.includes("书签")) return 0;
  if (/瓷砖|杯垫|马赛克/.test(name)) return 1;
  if (name.includes("扇")) return 2;
  if (/香料|袋/.test(name)) return 3;
  if (/黑石|石/.test(name)) return 4;
  if (/小铜佛|佛/.test(name)) return 5;
  if (/布|毯/.test(name)) return 6;
  if (/瓷|碗/.test(name)) return 7;
  if (/旅行牌|票根|贝壳/.test(name)) return 8;
  return [7, 4, 7, 6][slot % 4] ?? 7;
}

const MOVEMENT_HINTS = {
  idle: "点空地走走 · 点椅子坐下",
  seated: "点空地走走 · 点椅子坐下",
  rise: "先从椅子上起来…",
  "jump-down": "从椅子上跳下来…",
  walk: "蛙蛙走过去…",
  "jump-up": "跳回椅子上…",
  sit: "在椅子上坐好…",
};

/** The painted room is scenery; every card, photo and frog is a live archive object. */
export function HomeRoom({
  home,
  furniture,
  luggage,
  postcards,
  onPerch,
  onMap,
  onSpecialty,
  onPostcard,
  onMoveHome,
}: HomeRoomProps) {
  const [spatial, setSpatial] = useState(false);
  const [collection, setCollection] = useState<
    "postcards" | "souvenirs" | null
  >(null);
  const [shelfPage, setShelfPage] = useState(0);
  const [moving, setMoving] = useState(false);
  const [cityName, setCityName] = useState(home.city.name);
  const [luggageOpen, setLuggageOpen] = useState(false);
  const { actor, target, move, changePose } = useRoomFrog(
    home.perch,
    luggage,
    onPerch,
  );
  const busy = actor.phase !== "idle" && actor.phase !== "seated";
  const pose = actor.pose;
  const visitDisplay = (display: HomeDisplay) => {
    move({ kind: "perch", perch: perchForDisplay(display) });
  };
  const depth =
    0.86 + 0.2 * Math.max(0, Math.min(1, (actor.position.y - 70) / 28));
  const jumping = actor.phase === "jump-down" || actor.phase === "jump-up";
  const luggageFront = { small: 93.2, standard: 93.2, wardrobe: 95.5 }[luggage];
  const onChair =
    actor.phase === "seated" || actor.phase === "rise" || actor.phase === "sit";
  let layer = 20;
  if (!jumping) {
    if (onChair || actor.position.y < 89) layer = 10;
    else if (actor.position.x > 77 && actor.position.y < luggageFront)
      layer = 16;
  }
  const pinned = postcards.filter(
    (card) =>
      card.status !== "fulfilled" &&
      card.status !== "declined" &&
      card.status !== "pending",
  );
  const archived = postcards
    .filter((card) => card.status === "fulfilled")
    .slice()
    .sort((a, b) => a.year - b.year);
  const submitMove = async () => {
    if (
      cityName.trim() &&
      cityName.trim() !== home.city.name &&
      (await onMoveHome(cityName.trim()))
    )
      setMoving(false);
  };
  return (
    <div
      className="home-room"
      data-furniture={furniture.stage}
      data-luggage={luggage}
    >
      <button
        type="button"
        className="room-view-toggle"
        onClick={() => setSpatial(!spatial)}
      >
        {spatial ? "插画视角" : "环视房间"}
      </button>
      {spatial && (
        <Suspense fallback={<p className="space-hint">正在打开房间…</p>}>
          <SpatialRoom
            actor={actor}
            furniture={furniture}
            luggage={luggage}
            postcards={postcards}
            specialties={home.specialties}
            city={home.city.name}
            onMove={move}
            onPose={changePose}
            onMap={onMap}
            onPostcard={onPostcard}
            onSpecialty={onSpecialty}
            onCollection={setCollection}
          />
        </Suspense>
      )}
      <div className="home-stage" hidden={spatial}>
        <div className="home-scene" aria-hidden="true" />
        <div className="home-vignette" aria-hidden="true" />
        <button
          className="room-floor"
          type="button"
          aria-label="房间地板 · 点击走动，方向键移动"
          style={{
            clipPath: `polygon(${ROOM_FLOOR.map((point) => `${point.x}% ${point.y}%`).join(",")})`,
          }}
          onClick={(event) => {
            if (!event.detail) {
              move({ kind: "floor", point: { x: 50, y: 97 } });
              return;
            }
            const rect = event.currentTarget.getBoundingClientRect();
            move({
              kind: "floor",
              point: {
                x: ((event.clientX - rect.left) / rect.width) * 100,
                y: ((event.clientY - rect.top) / rect.height) * 100,
              },
            });
          }}
          onKeyDown={(event) => {
            const directions: Record<string, readonly [number, number]> = {
              ArrowLeft: [-6, 0],
              ArrowRight: [6, 0],
              ArrowUp: [0, -6],
              ArrowDown: [0, 6],
            };
            const delta = directions[event.key];
            if (!delta) return;
            event.preventDefault();
            move({
              kind: "floor",
              point: {
                x: actor.position.x + delta[0],
                y: actor.position.y + delta[1],
              },
            });
          }}
        />
        <div
          className="home-scene room-occluder room-table-occluder"
          aria-hidden="true"
        />
        <div
          className="home-scene room-occluder room-chair-arm-occluder"
          aria-hidden="true"
        />
        <div
          className="home-scene room-occluder room-table-legs-occluder"
          aria-hidden="true"
        />
        {target && (
          <span
            className="frog-destination"
            style={{ left: `${target.x}%`, top: `${target.y}%` }}
            aria-hidden="true"
          />
        )}
        <header className="home-bar">
          <button type="button" className="home-back" onClick={onMap}>
            ← 回到地图
          </button>
          <div className="home-city">
            <button
              type="button"
              className="home-city-chip"
              aria-expanded={moving}
              onClick={() => {
                setCityName(home.city.name);
                setMoving(!moving);
              }}
            >
              家 · {home.city.name}
            </button>
            {moving && (
              <form
                className="home-move"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitMove();
                }}
              >
                <input
                  aria-label="家所在的城市"
                  value={cityName}
                  onChange={(event) => setCityName(event.target.value)}
                  maxLength={20}
                />
                <button type="submit">搬家</button>
              </form>
            )}
          </div>
        </header>
        <button
          className="room-hotspot room-hearth"
          type="button"
          aria-label="壁炉"
          onClick={() => visitDisplay("fireplace")}
        />
        <button
          className="room-hotspot room-chair"
          type="button"
          aria-label="扶手椅"
          onClick={() => move({ kind: "perch", perch: "armchair" })}
        />
        <button
          className="room-hotspot room-lamp"
          type="button"
          aria-label="到落地灯旁"
          onClick={() => visitDisplay("lamp")}
        />
        <button
          className="room-hotspot room-curio-frame"
          type="button"
          aria-label="多宝阁架"
          onClick={() => visitDisplay("curio")}
        />
        <button
          className="room-map"
          type="button"
          aria-label="矮几上摊开的世界地图 · 展开地图"
          onClick={onMap}
        />
        <div
          className="room-postcards"
          role="group"
          aria-label="明信片板"
          onClick={() => visitDisplay("postcard-wall")}
        >
          {pinned.slice(0, 8).map((card, index) => (
            <button
              key={card.id}
              type="button"
              className={`room-card st-${card.status}`}
              style={
                {
                  "--slot": index % 4,
                  "--row": Math.floor(index / 4),
                  "--card-tilt": `${index % 2 ? 5 : -6}deg`,
                } as CSSProperties
              }
              aria-label={`${card.name} · ${wishStatusLabel(card.status)}`}
              onClick={(event) => {
                event.stopPropagation();
                onPostcard(card.id);
              }}
            >
              <span className="room-card-pin" />
              <span className="room-card-city">{card.name}</span>
              <span className="room-card-lines" />
              {card.status === "received" && <i className="room-card-dot" />}
              {card.status === "stamped" && (
                <span className="room-card-stamp">想去</span>
              )}
            </button>
          ))}
          {archived.slice(-4).map((card, index) => (
            <button
              className="room-card is-archived"
              style={
                {
                  "--slot": index,
                  "--row": 2,
                  "--card-tilt": "-3deg",
                } as CSSProperties
              }
              key={card.id}
              type="button"
              aria-label={`${card.name} · ${card.year} 年归档`}
              onClick={(event) => {
                event.stopPropagation();
                onPostcard(card.id);
              }}
            >
              <span className="room-card-city">{card.year}</span>
            </button>
          ))}
        </div>
        <div
          className="room-curio"
          role="group"
          aria-label="多宝阁"
          onClick={() => visitDisplay("curio")}
        >
          {curioSlots(
            home.specialties.slice(shelfPage * 8, shelfPage * 8 + 8),
          ).map((slot) =>
            slot.specialty ? (
              <button
                className={`room-souvenir souvenir-${souvenirIndex(slot.specialty.name, slot.index)}`}
                key={slot.index}
                style={
                  {
                    "--shelf-col": slot.index % 2,
                    "--shelf-row": Math.floor(slot.index / 2),
                  } as CSSProperties
                }
                type="button"
                aria-label={`${slot.specialty.name} · 来自${slot.specialty.cityKey}`}
                title={slot.specialty.name}
                onClick={(event) => {
                  event.stopPropagation();
                  onSpecialty(slot.specialty as SpecialtyAward);
                }}
              >
                <span />
              </button>
            ) : (
              <span
                key={slot.index}
                className="room-souvenir is-empty"
                aria-hidden="true"
              />
            ),
          )}
        </div>
        <button
          type="button"
          className={`room-luggage tier-${luggage}`}
          aria-label={`行李 · ${LUGGAGE_LABELS[luggage]}`}
          onClick={() => {
            setLuggageOpen(true);
          }}
        >
          <span className="luggage-art" />
        </button>
        <button
          className="home-frog room-actor"
          data-pose={pose}
          data-phase={actor.phase}
          data-facing={actor.facing}
          style={
            {
              left: `${actor.position.x}%`,
              top: `${actor.position.y}%`,
              width: `${14.5 * depth}%`,
              zIndex: layer,
              "--jump-height": `${(actor.jump * 9) / 16}cqw`,
              "--frog-facing": actor.facing === "left" ? -1 : 1,
              "--shadow-scale": 1 - (actor.jump / 5.5) * 0.55,
              "--squash-y":
                actor.phase === "rise" || actor.phase === "sit"
                  ? 0.9 + actor.progress * 0.1
                  : 1,
            } as CSSProperties
          }
          type="button"
          aria-label={
            busy
              ? "青蛙正在移动"
              : `青蛙在${actor.perch ? PERCH_LABELS[actor.perch] : "房间里"} · ${FROG_POSE_LABELS[pose]} · 点击换姿态`
          }
          aria-busy={busy}
          onClick={changePose}
        >
          <span className="frog-elevation">
            <span className="frog-gait">
              <FrogPerchFigure
                perch={actor.perch ?? "fireplace-rug"}
                pose={pose}
                locationLabel={
                  actor.perch ? PERCH_LABELS[actor.perch] : "房间里"
                }
              />
            </span>
          </span>
        </button>
        <nav className="room-archive-links" aria-label="家中的收藏">
          <button type="button" onClick={() => setCollection("postcards")}>
            墙上来信
          </button>
          <button type="button" onClick={() => setCollection("souvenirs")}>
            旅行纪念品
          </button>
          {home.specialties.length > 8 && (
            <button
              type="button"
              onClick={() =>
                setShelfPage(
                  (shelfPage + 1) % Math.ceil(home.specialties.length / 8),
                )
              }
            >
              换一层陈列 · {shelfPage + 1}/
              {Math.ceil(home.specialties.length / 8)}
            </button>
          )}
        </nav>
        <p className="room-walk-hint" role="status" aria-live="polite">
          {MOVEMENT_HINTS[actor.phase]}
        </p>
      </div>
      {collection && (
        <div
          className="room-collection"
          role="dialog"
          aria-modal="true"
          aria-label={
            collection === "postcards" ? "全部墙上来信" : "全部旅行纪念品"
          }
          onClick={() => setCollection(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              setCollection(null);
            }
          }}
        >
          <section onClick={(e) => e.stopPropagation()}>
            <header>
              <h2>{collection === "postcards" ? "墙上来信" : "旅行纪念品"}</h2>
              <button
                autoFocus
                type="button"
                aria-label="收起收藏"
                onClick={() => setCollection(null)}
              >
                ×
              </button>
            </header>
            <p>
              {collection === "postcards"
                ? "蛙蛙寄来的每一张，都在这里。"
                : "每件纪念品，都连着一段走过的旅行。"}
            </p>
            <div className="room-collection-grid">
              {collection === "postcards"
                ? postcards
                    .filter((c) => !["pending", "declined"].includes(c.status))
                    .map((card) => (
                      <button
                        type="button"
                        key={card.id}
                        onClick={() => {
                          setCollection(null);
                          onPostcard(card.id);
                        }}
                      >
                        <span className="collection-letter">✉</span>
                        <strong>{card.name}</strong>
                        <span>
                          {wishStatusLabel(card.status)} · {card.year}
                        </span>
                      </button>
                    ))
                : home.specialties.map((award) => (
                    <button
                      type="button"
                      key={award.specialtyId}
                      onClick={() => {
                        setCollection(null);
                        onSpecialty(award);
                      }}
                    >
                      <strong>{award.name}</strong>
                      <span>{award.cityKey.split(":").slice(1).join(":")}</span>
                    </button>
                  ))}
            </div>
            {(collection === "postcards"
              ? postcards.filter(
                  (c) => !["pending", "declined"].includes(c.status),
                ).length
              : home.specialties.length) === 0 && (
              <p>这里还空着。想起一段旅行时，再回来看看。</p>
            )}
          </section>
        </div>
      )}
      {luggageOpen && (
        <div
          className="luggage-focus"
          role="dialog"
          aria-label="旅行的行李"
          onClick={() => setLuggageOpen(false)}
        >
          <div
            className="luggage-card"
            onClick={(event) => event.stopPropagation()}
          >
            <span className={`luggage-preview tier-${luggage}`} />
            <p>{LUGGAGE_LABELS[luggage]}</p>
            <span>走过的地方，都装得下。</span>
            <button type="button" onClick={() => setLuggageOpen(false)}>
              收好
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export interface SpecialtyProvenance {
  readonly award: SpecialtyAward;
  readonly cityName: string;
  readonly tripTitle: string;
  readonly photos: readonly {
    readonly id: string;
    readonly image: string;
    readonly day: string;
  }[];
}

export interface SpecialtyFocusProps {
  readonly provenance: SpecialtyProvenance;
  readonly onClose: () => void;
}

/** Clicking a souvenir only expands where it came from. */
export function SpecialtyFocus({ provenance, onClose }: SpecialtyFocusProps) {
  const { award } = provenance;
  return (
    <div
      className="specialty-focus"
      role="dialog"
      aria-label={`${award.name} 的来历`}
      onClick={onClose}
    >
      <div
        className="specialty-card"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="sf-kicker">特产来历</span>
        <span className="sf-name">{award.name}</span>
        <span className="sf-line">
          {provenance.cityName} · {provenance.tripTitle}
        </span>
        <span className="sf-date">
          带回于 {new Date(award.awardedAt).toISOString().slice(0, 10)}
        </span>
        {provenance.photos.length > 0 ? (
          <div className="sf-photos">
            {provenance.photos.map((photo) => (
              <span
                key={photo.id}
                className="sf-photo"
                title={photo.day}
                style={
                  { backgroundImage: `url("${photo.image}")` } as CSSProperties
                }
              />
            ))}
          </div>
        ) : null}
        <button type="button" className="sf-close" onClick={onClose}>
          收回
        </button>
      </div>
    </div>
  );
}
