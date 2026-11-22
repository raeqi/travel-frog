import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { fnv1a, postcardTilt } from './geometry';
import { formattedDay, isNewWish, type WallWish } from './model';
import { POSTCARD_STATUS } from './postcard-mark';
import { MISSING_PHOTO } from './usePhotoImages';
import './postcard.css';

export function PostcardBody({ wish, now }: { wish: WallWish; now: number }) {
  if (wish.status === 'pending') {
    return (
      <>
        <span className="pc-place">{wish.name}</span>
        <span className="pc-wait">{wish.journey?'等旅途来信':wish.demo?'示例 · 等待展示':'等青蛙路过'}</span>
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
    width: `${card.width}px`,
    height: `${card.height}px`,
    '--tilt': postcardTilt(wish.id),
    '--fly-x': `${card.flyX.toFixed(0)}px`,
    '--fly-y': `${card.flyY.toFixed(0)}px`,
  } as CSSProperties;
  const className = [
    'postcard-mark',
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
      title={`${wish.name} · ${POSTCARD_STATUS[wish.status]} · 查看明信片`}
      aria-label={`${wish.name}的明信片 · ${wish.countryName} · ${POSTCARD_STATUS[wish.status]}${isNewWish(wish,now)?' · 最近来信':''}`}
      aria-haspopup="dialog"
      aria-expanded={card.flipping}
      onClick={(event) => {
        event.stopPropagation();
        onClick(wish);
      }}
    >
      <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">
        <circle cx="20" cy="20" r="16" className="postmark-ring" />
        <circle cx="20" cy="20" r="12" className="postmark-inner" />
        <path d="M11 15h18v12H11z M11 15l9 7 9-7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        {wish.status==='stamped'||wish.status==='fulfilled'?<path d="m24 29 3 3 6-7" className="postmark-check"/>:null}
      </svg>
      {(wish.status==='received'||isNewWish(wish,now))&&<span className="postmark-new" aria-hidden="true"/>}
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
  photos,
  photoImage,
  onChoose,
  busy,
  onClose,
}: WishFocusProps) {
  const choosing = wish.status === 'received' || wish.status === 'opened';
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;
    dialog.current?.querySelector<HTMLButtonElement>('.wf-close')?.focus();
    return ()=>{if(previous?.isConnected)previous.focus();};
  },[wish.id]);
  const [failedImages,setFailedImages] = useState<ReadonlySet<string>>(()=>new Set());
  // Resolve availability before limiting, so a broken thumbnail cannot hide a
  // valid same-city image from a later visit/trip. Never show the missing art.
  const images = photos.map(photo=>({...photo,image:photoImage(photo.id)})).filter((p):p is WishBackPhoto & {image:string}=>!!p.image&&p.image!==MISSING_PHOTO&&!failedImages.has(`${p.id}:${p.image}`)).slice(0,4);
  return (
    <div ref={dialog} className="wish-focus" role="dialog" aria-modal="true" aria-label={`${wish.name} 的明信片背面`} onClick={onClose} onKeyDown={event=>{
      if(event.key!=='Tab')return;
      const buttons=Array.from(dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')??[]),first=buttons[0],last=buttons[buttons.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }}>
      <div
        className="wish-focus-card"
        style={{ '--tilt': postcardTilt(wish.id) } as CSSProperties}
        onClick={event=>{event.stopPropagation();onClose();}}
      >
        <span className="wf-place">{wish.name}</span>
        <span className="wf-status">{POSTCARD_STATUS[wish.status]}</span>
        {images.length > 0 ? (
          <span className="wf-photos">
            {images.map((photo) => {
              return (
                <img
                  key={photo.id}
                  className="wf-photo"
                  data-footprint-photo={photo.id}
                  src={photo.image}
                  alt={`${wish.name}的同城足迹照片`}
                  onError={()=>setFailedImages(previous=>new Set(previous).add(`${photo.id}:${photo.image}`))}
                />
              );
            })}
          </span>
        ) : null}
        <span className="wf-photo-source">{images.length?'你的同城足迹照片，不是蛙蛙寄来的图片。':'这封来信是文字寄语；有可用的同城足迹照片时才会展示。'}</span>
        <span className="wf-note">{wish.note ?? (wish.journey?'你留好的旅行方向。蛙蛙会在这趟或下一趟停留期间寄信，进度可在“蛙蛙的旅行”查看。':wish.demo?'这是展示待寄状态的示例卡片，不会自动投递。蛙蛙自己的旅行可以在旅行面板查看。':'蛙蛙还没有寄来这张信。')}</span>
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
        <button className="wf-close" type="button" aria-label="钉回明信片" onClick={event=>{event.stopPropagation();onClose();}}>×</button>
      </div>
    </div>
  );
}
