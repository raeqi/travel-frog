import { useState, type CSSProperties } from 'react';
import type { HomeState } from '../../domain/home/home';
import {
  curioSlots,
  type FurnitureState,
  type LuggageTier,
  type SpecialtyAward,
} from '../../domain/home/collection';
import { PERCH_LABELS, type FrogPerch, type HomeDisplay } from '../../domain/home/perch';
import type { WishStatus } from '../../domain/wish/wish';
import { FrogFigure } from './Frog';

/** A postcard on the home board: the same object the map renders, no home-only state. */
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
  readonly mapPhotos: readonly { readonly id: string; readonly image: string }[];
  readonly postcards: readonly HomePostcard[];
  readonly onFrog: () => void;
  readonly onPerch: (perch: FrogPerch) => void;
  readonly onDisplay: (display: HomeDisplay) => void;
  readonly onMap: () => void;
  readonly onSpecialty: (award: SpecialtyAward) => void;
  readonly onPostcard: (wishId: string) => void;
  readonly onMoveHome: (cityName: string) => Promise<boolean>;
}

/**
 * The room behind the map. Every display here expands an existing memory; nothing is
 * generated, dropped or unlocked by clicking. Only the frog, the three main displays
 * and the souvenirs are interactive.
 */
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
  const pinned = postcards.filter((card) => card.status !== 'fulfilled');
  const archived = postcards
    .filter((card) => card.status === 'fulfilled')
    .slice()
    .sort((a, b) => a.year - b.year);

  const submitMove = async () => {
    const name = cityName.trim();
    if (name.length === 0 || name === home.city.name) return;
    const ok = await onMoveHome(name);
    if (ok) setMoving(false);
  };

  return (
    <div className="home-room" data-furniture={furniture.stage} data-luggage={luggage}>
      <div className="home-vignette" aria-hidden="true" />

      <header className="home-bar">
        <button type="button" className="home-back" onClick={onMap}>
          回到地图
        </button>
        <div className="home-city">
          <button
            type="button"
            className="home-city-chip"
            aria-expanded={moving}
            onClick={() => {
              setCityName(home.city.name);
              setMoving((open) => !open);
            }}
          >
            家 · {home.city.name}
          </button>
          {moving ? (
            <form
              className="home-move"
              onSubmit={(event) => {
                event.preventDefault();
                void submitMove();
              }}
            >
              <input
                value={cityName}
                onChange={(event) => setCityName(event.target.value)}
                aria-label="家所在的城市"
                maxLength={20}
              />
              <button type="submit">搬家</button>
            </form>
          ) : null}
        </div>
      </header>

      <div className="home-wall" aria-hidden="true">
        <span className="home-window" />
      </div>

      <button
        type="button"
        className="home-fireplace"
        data-lit={furniture.fireplaceLit}
        aria-label="壁炉"
        title="壁炉"
        onClick={() => onDisplay('fireplace')}
      />

      <div className="home-rug" aria-hidden="true" />

      <button
        type="button"
        className="home-armchair"
        aria-label="扶手椅"
        title="扶手椅"
        onClick={() => onPerch('armchair')}
      />

      <button
        type="button"
        className={`home-lamp${furniture.floorLampLit ? ' is-lit' : ''}`}
        aria-label="落地灯"
        title="落地灯"
        onClick={() => onDisplay('lamp')}
      />
      <button type="button" className="home-footstool" aria-label="脚凳" title="脚凳" onClick={() => onDisplay('lamp')} />

      <button
        type="button"
        className="home-map-table"
        aria-label="矮几上摊开的世界地图 · 展开地图"
        title="展开地图"
        onClick={onMap}
      >
        <span className="home-map-sheet" aria-hidden="true">
          {mapPhotos.slice(0, 4).map((photo, index) => (
            <span
              key={photo.id}
              className={`home-map-photo p${index}`}
              style={{ backgroundImage: `url("${photo.image}")` }}
              aria-hidden="true"
            />
          ))}
          {['p1', 'p2', 'p3', 'p4'].map((pin) => (
            <i key={pin} className={`home-pin ${pin}`} aria-hidden="true" />
          ))}
        </span>
      </button>

      <div
        className="home-postcard-wall"
        role="group"
        aria-label="明信片板"
        onClick={() => onDisplay('postcard-wall')}
      >
        {pinned.map((card, index) => (
          <button
            key={card.id}
            type="button"
            className={`home-postcard st-${card.status} slot-${index % 5}`}
            aria-label={`${card.name} · ${card.status === 'pending' ? '待寄出' : card.status === 'wished' ? '已盖戳' : '来信'}`}
            title={card.name}
            onClick={(event) => {
              event.stopPropagation();
              onPostcard(card.id);
            }}
          >
            {card.status === 'wished' ? <span className="home-postcard-stamp" aria-hidden="true" /> : null}
          </button>
        ))}
        {archived.length > 0 ? (
          <div className="home-postcard-archive" aria-label="按年份归档的明信片">
            {archived.map((card) => (
              <button
                key={card.id}
                type="button"
                className="home-postcard is-archived"
                data-year={card.year}
                aria-label={`${card.name} · ${card.year} 年归档`}
                title={card.name}
                onClick={(event) => {
                  event.stopPropagation();
                  onPostcard(card.id);
                }}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div className="home-curio" role="group" aria-label="多宝阁" onClick={() => onDisplay('curio')}>
        <div className="home-curio-shelves">
          {curioSlots(home.specialties).map((slot) =>
            slot.specialty ? (
              <button
                key={slot.index}
                type="button"
                className="home-specialty"
                aria-label={`${slot.specialty.name} · 来自${slot.specialty.cityKey}`}
                title={slot.specialty.name}
                onClick={(event) => {
                  event.stopPropagation();
                  onSpecialty(slot.specialty as SpecialtyAward);
                }}
              >
                <span className="home-specialty-mark" aria-hidden="true" />
              </button>
            ) : (
              <span key={slot.index} className="home-specialty is-empty" aria-hidden="true" />
            ),
          )}
        </div>
      </div>

      {furniture.sideboard ? (
        <button
          type="button"
          className="home-sideboard"
          aria-label="边柜"
          title="边柜"
          onClick={() => onDisplay('bookshelf')}
        />
      ) : null}

      {furniture.roundMirror ? <span className="home-mirror" aria-hidden="true" /> : null}

      {furniture.bookshelf ? (
        <button
          type="button"
          className="home-bookshelf"
          aria-label="矮书架"
          title="矮书架"
          onClick={() => onDisplay('bookshelf')}
        />
      ) : null}

      {furniture.globe ? <span className="home-globe" aria-hidden="true" /> : null}

      <button
        type="button"
        className={`home-suitcase is-${luggage}${furniture.suitcaseFilled ? ' is-filled' : ''}`}
        aria-label="敞开的行李箱"
        title="敞开的行李箱"
        onClick={() => onDisplay('suitcase')}
      />

      <button
        type="button"
        className={`home-frog perch-${home.perch}`}
        aria-label={`青蛙在${PERCH_LABELS[home.perch]} · 点击换一个位置`}
        title={PERCH_LABELS[home.perch]}
        onClick={(event) => {
          event.stopPropagation();
          onFrog();
        }}
      >
        <FrogFigure mode="rest" charmCount={0} />
      </button>
    </div>
  );
}

export interface SpecialtyProvenance {
  readonly award: SpecialtyAward;
  readonly cityName: string;
  readonly tripTitle: string;
  readonly photos: readonly { readonly id: string; readonly image: string; readonly day: string }[];
}

export interface SpecialtyFocusProps {
  readonly provenance: SpecialtyProvenance;
  readonly onClose: () => void;
}

/** Clicking a souvenir only expands where it came from. */
export function SpecialtyFocus({ provenance, onClose }: SpecialtyFocusProps) {
  const { award } = provenance;
  return (
    <div className="specialty-focus" role="dialog" aria-label={`${award.name} 的来历`} onClick={onClose}>
      <div className="specialty-card" onClick={(event) => event.stopPropagation()}>
        <span className="sf-kicker">特产来历</span>
        <span className="sf-name">{award.name}</span>
        <span className="sf-line">
          {provenance.cityName} · {provenance.tripTitle}
        </span>
        <span className="sf-date">带回于 {new Date(award.awardedAt).toISOString().slice(0, 10)}</span>
        {provenance.photos.length > 0 ? (
          <div className="sf-photos">
            {provenance.photos.map((photo) => (
              <span
                key={photo.id}
                className="sf-photo"
                title={photo.day}
                style={{ backgroundImage: `url("${photo.image}")` } as CSSProperties}
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
