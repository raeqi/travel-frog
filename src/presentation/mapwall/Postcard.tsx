import type { CSSProperties } from 'react';
import { fnv1a, postcardTilt } from './geometry';
import type { WishStatus } from '../../domain/wish/wish';
import { formattedDay, isNewWish, type WallWish } from './model';
import { paletteFor, scene, type PaletteName } from './photoArt';

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
      {wish.status === 'stamped' ? (
        <span className={`pc-stamp${olive ? ' olive' : ''}`} />
      ) : null}
      {isNewWish(wish, now) ? <span className="pc-new" /> : null}
      {wish.status === 'received' ? <span className="pc-received-dot" /> : null}
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
  readonly flipping: boolean;
  readonly fresh: boolean;
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
    card.fresh ? 'is-fresh' : '',
    card.dropping ? 'is-dropping' : '',
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

export interface WishBackPhoto {
  readonly id: string;
  readonly at: number;
}

export interface WishFocusProps {
  readonly wish: WallWish;
  readonly left: number;
  readonly top: number;
  readonly photos: readonly WishBackPhoto[];
  readonly photoImage: (photoId: string) => string | null;
  readonly onAdvance: (status: 'opened' | 'stamped' | 'fulfilled') => void;
  readonly onClose: () => void;
}

/**
 * The postcard lifted off the wall and turned over. Clicking anywhere on the card pins it
 * back; the only state changes are the explicit postcard transitions on the back side.
 */
const NEXT_STEP: Partial<Record<WishStatus, { status: 'opened' | 'stamped' | 'fulfilled'; label: string }>> = {
  received: { status: 'opened', label: '掀开' },
  opened: { status: 'stamped', label: '盖戳' },
  stamped: { status: 'fulfilled', label: '兑现' },
};

export function WishFocus({
  wish,
  left,
  top,
  photos,
  photoImage,
  onAdvance,
  onClose,
}: WishFocusProps) {
  const step = NEXT_STEP[wish.status];
  const first = photos[0];
  const firstImage = first ? photoImage(first.id) : null;
  const portrait = firstImage ?? (wish.status === 'pending' ? null : scene(fnv1a(`${wish.id}:open`), paletteFor(fnv1a(wish.id))));
  return (
    <div className="wish-focus" role="dialog" aria-label={`${wish.name} 的明信片背面`} onClick={onClose}>
      <div
        className="wish-focus-card"
        style={{ '--from-x': `${left}px`, '--from-y': `${top}px`, '--tilt': postcardTilt(wish.id) } as CSSProperties}
        onClick={onClose}
      >
        <span
          className="wf-portrait"
          style={portrait ? { backgroundImage: `url("${portrait}")` } : undefined}
          aria-hidden="true"
        />
        <span className="wf-copy">
          <span className="wf-place">{wish.name}</span>
          <span className="wf-note">{wish.note ?? ''}</span>
          <span className="wf-date">青蛙寄于 {formattedDay(wish.createdAt)}</span>
          <span className="wf-coords">
            {wish.lat.toFixed(4)}, {wish.lng.toFixed(4)}
          </span>
          {step ? (
            <span className="wf-actions" onClick={(event) => event.stopPropagation()}>
              <button type="button" className="primary" onClick={() => onAdvance(step.status)}>
                {step.label}
              </button>
            </span>
          ) : null}
        </span>
        {wish.status === 'stamped' || wish.status === 'fulfilled' ? <span className="pc-stamp" aria-hidden="true" /> : null}
      </div>
    </div>
  );
}
