import type { CSSProperties } from 'react';
import { fnv1a, postcardTilt } from './geometry';
import { formattedDay, isNewWish, type WallWish } from './model';
import { scene, type PaletteName } from './photoArt';

const STACK_PALETTES: readonly PaletteName[] = ['temple', 'city', 'sea', 'forest'];

const filledStyle = (value: string): CSSProperties => ({ backgroundImage: `url("${value}")` });

function StackCard({ wish, index }: { wish: WallWish; index: number }) {
  const palette = STACK_PALETTES[(fnv1a(wish.id) + index) % STACK_PALETTES.length] ?? 'temple';
  const image = scene(fnv1a(`${wish.id}:fp:${index}`), palette);
  return (
    <span
      className="fp-card"
      style={{
        transform: `translate(-50%,-50%) rotate(${(index - 1) * 5 + 1}deg) translate(${index * 2 - 2}px,${index * 2 - 2}px)`,
      }}
    >
      <span className="img" style={filledStyle(image)} />
    </span>
  );
}

export function PostcardBody({ wish, now }: { wish: WallWish; now: number }) {
  if (wish.status === 'fulfilled') {
    return (
      <>
        {[0, 1, 2].map((index) => (
          <StackCard key={index} wish={wish} index={index} />
        ))}
        <span className="fp-label">{wish.name}</span>
      </>
    );
  }
  if (wish.status === 'pending') {
    return (
      <>
        <span className="pc-place">{wish.name}</span>
        <span className="pc-wait">等青蛙路过</span>
      </>
    );
  }
  const olive = fnv1a(wish.id) % 3 === 0;
  return (
    <>
      <span className="pc-place">{wish.name}</span>
      <span className="pc-note">{wish.note ?? ''}</span>
      <span className="pc-meta">{formattedDay(wish.createdAt)}</span>
      <span className="pc-ring" />
      <span className={`pc-stamp${olive ? ' olive' : ''}`} />
      {isNewWish(wish, now) ? <span className="pc-new" /> : null}
      {wish.status === 'wished' ? <span className="pc-wish-stamp">想去</span> : null}
    </>
  );
}

export interface PlacedPostcard {
  readonly wish: WallWish;
  readonly cx: number;
  readonly cy: number;
  readonly width: number;
  readonly height: number;
  readonly arriving: boolean;
  readonly dropping: boolean;
  readonly leaving: boolean;
  readonly flipping: boolean;
  readonly flyX: number;
  readonly flyY: number;
}

export interface PostcardNodeProps {
  readonly card: PlacedPostcard;
  readonly now: number;
  readonly highlighted: boolean;
  readonly onClick: (wish: WallWish) => void;
}

export function PostcardNode({ card, now, highlighted, onClick }: PostcardNodeProps) {
  const { wish } = card;
  const style = {
    left: `${card.cx}px`,
    top: `${card.cy}px`,
    '--tilt': postcardTilt(wish.id),
    '--fly-x': `${card.flyX.toFixed(0)}px`,
    '--fly-y': `${card.flyY.toFixed(0)}px`,
  } as CSSProperties;
  const className = [
    'wish',
    `st-${wish.status}`,
    card.arriving ? 'is-arriving' : '',
    card.dropping ? 'is-dropping' : '',
    card.leaving ? 'is-leaving' : '',
    card.flipping ? 'is-flipping' : '',
    highlighted ? 'is-hl' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type="button"
      className={className}
      style={style}
      data-wish={wish.id}
      data-city={wish.cityKey}
      title={`${wish.name} · ${wish.countryName}${wish.note ? ` · ${wish.note}` : ''}`}
      onClick={(event) => {
        event.stopPropagation();
        onClick(wish);
      }}
    >
      <PostcardBody wish={wish} now={now} />
    </button>
  );
}

export interface WishFocusProps {
  readonly wish: WallWish;
  readonly left: number;
  readonly top: number;
  readonly onKeep: () => void;
  readonly onDecline: () => void;
  readonly onClose: () => void;
}

export function WishFocus({ wish, left, top, onKeep, onDecline, onClose }: WishFocusProps) {
  return (
    <div className="wish-focus" role="dialog" aria-label={`${wish.name} 的明信片`} onClick={onClose}>
      <div
        className="wish-focus-card"
        style={{ left: `${left}px`, top: `${top}px`, '--tilt': postcardTilt(wish.id) } as CSSProperties}
        onClick={(event) => event.stopPropagation()}
      >
        <span className="wf-place">{wish.name}</span>
        <span className="wf-note">{wish.note ?? ''}</span>
        <span className="wf-date">青蛙寄于 {formattedDay(wish.createdAt)}</span>
        <span className="pc-ring" />
        <span className="pc-stamp" />
        <div className="wf-actions">
          <button type="button" className="primary" onClick={onKeep}>
            留着
          </button>
          <button type="button" onClick={onDecline}>
            这次不去
          </button>
        </div>
      </div>
    </div>
  );
}
