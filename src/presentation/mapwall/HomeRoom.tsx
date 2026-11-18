import { useState, type CSSProperties } from "react";
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
  type FrogPerch,
  type HomeDisplay,
} from "../../domain/home/perch";
import { wishStatusLabel, type WishStatus } from "../../domain/wish/wish";
import { FrogPerchFigure } from "./Frog";

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
  readonly mapPhotos: readonly {
    readonly id: string;
    readonly image: string;
  }[];
  readonly postcards: readonly HomePostcard[];
  readonly onFrog: () => void;
  readonly onPerch: (perch: FrogPerch) => void;
  readonly onDisplay: (display: HomeDisplay) => void;
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
  return [7, 4, 7, 6][slot % 4] ?? 7;
}

/** The painted room is scenery; every card, photo and frog is a live archive object. */
export function HomeRoom({
  home,
  furniture,
  luggage,
  mapPhotos,
  postcards,
  onFrog,
  onPerch,
  onDisplay,
  onMap,
  onSpecialty,
  onPostcard,
  onMoveHome,
}: HomeRoomProps) {
  const [moving, setMoving] = useState(false);
  const [cityName, setCityName] = useState(home.city.name);
  const [luggageOpen, setLuggageOpen] = useState(false);
  const pinned = postcards.filter(
    (card) => card.status !== "fulfilled" && card.status !== "declined",
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
      <div className="home-stage">
        <div className="home-scene" aria-hidden="true" />
        <div className="home-vignette" aria-hidden="true" />
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
          onClick={() => onDisplay("fireplace")}
        />
        <button
          className="room-hotspot room-chair"
          type="button"
          aria-label="扶手椅"
          onClick={() => onPerch("armchair")}
        />
        <button
          className="room-hotspot room-lamp"
          type="button"
          aria-label="落地灯旁脚凳"
          onClick={() => onDisplay("lamp")}
        />
        <button
          className="room-map"
          type="button"
          aria-label="矮几上摊开的世界地图 · 展开地图"
          onClick={onMap}
        >
          {mapPhotos.slice(0, 4).map((photo, index) => (
            <span
              key={photo.id}
              className={`room-map-photo p${index}`}
              style={{ backgroundImage: `url("${photo.image}")` }}
            />
          ))}
        </button>
        <div
          className="room-postcards"
          role="group"
          aria-label="明信片板"
          onClick={() => onDisplay("postcard-wall")}
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
          onClick={() => onDisplay("curio")}
        >
          {curioSlots(home.specialties).map((slot) =>
            slot.specialty ? (
              <button
                className={`room-souvenir souvenir-${souvenirIndex(slot.specialty.name, slot.index)}`}
                key={slot.index}
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
            onDisplay("suitcase");
            setLuggageOpen(true);
          }}
        >
          <span className="luggage-art" />
        </button>
        <button
          className={`home-frog perch-${home.perch}`}
          type="button"
          aria-label={`青蛙在${PERCH_LABELS[home.perch]} · 点击换一个位置`}
          onClick={onFrog}
        >
          <FrogPerchFigure perch={home.perch} />
        </button>
      </div>
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
