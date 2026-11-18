import type { CSSProperties } from 'react';
import { fnv1a, postcardTilt } from './geometry';
import { formattedDay, isNewWish, type WallWish } from './model';

export function PostcardBody({ wish, now }: { wish: WallWish; now: number }) {
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
      <span className="pc-meta">{formattedDay(wish.deliveredAt ?? wish.createdAt)}</span>
      <span className="pc-ring" />
      {wish.status === 'stamped' || wish.status === 'fulfilled' ? (
        <><span className={`pc-stamp${olive ? ' olive' : ''}`} /><span className="pc-kept-stamp">{wish.status === 'fulfilled' ? '去过了' : '想去'}</span></>
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
  readonly onChoose: (keep: boolean) => void;
  readonly busy: boolean;
  readonly onClose: () => void;
}

/**
 * The postcard lifted off the wall and turned over. Clicking anywhere on the card pins it
 * back; the only state changes are the explicit postcard transitions on the back side.
 */
export function WishFocus({
  wish,
  left,
  top,
  photos,
  photoImage,
  onChoose,
  busy,
  onClose,
}: WishFocusProps) {
  const choosing = wish.status === 'received' || wish.status === 'opened';
  return (
    <div className="wish-focus" role="dialog" aria-label={`${wish.name} 的明信片背面`} onClick={onClose}>
      <div
        className="wish-focus-card"
        style={{ left: `${left}px`, top: `${top}px`, '--tilt': postcardTilt(wish.id) } as CSSProperties}
        onClick={onClose}
      >
        <span className="wf-place">{wish.name}</span>
        {photos.length > 0 ? (
          <span className="wf-photos">
            {photos.map((photo) => {
              const image = photoImage(photo.id);
              return (
                <span
                  key={photo.id}
                  className="wf-photo"
                  style={image ? { backgroundImage: `url("${image}")` } : undefined}
                />
              );
            })}
          </span>
        ) : null}
        <span className="wf-note">{wish.note ?? ''}</span>
        <span className="wf-date">{wish.status === 'pending' ? '等青蛙路过' : `青蛙寄于 ${formattedDay(wish.deliveredAt ?? wish.createdAt)}`}</span>
        <span className="wf-coords">
          {wish.lat.toFixed(4)}, {wish.lng.toFixed(4)}
        </span>
        <span className="pc-ring" />
        {wish.status === 'stamped' || wish.status === 'fulfilled' ? <span className="pc-stamp" /> : null}
        {wish.status === 'stamped' ? <span className="wf-kept">想去 · 留在这面墙上</span> : null}
        {choosing ? (
          <div className="wf-actions" onClick={(event) => event.stopPropagation()}>
            <button type="button" disabled={busy} className="primary" onClick={() => onChoose(true)}>
              留着
            </button>
            <button type="button" disabled={busy} onClick={() => onChoose(false)}>这次不去</button>
          </div>
        ) : null}
        <button className="wf-close" type="button" aria-label="钉回明信片" onClick={onClose}>×</button>
      </div>
    </div>
  );
}
