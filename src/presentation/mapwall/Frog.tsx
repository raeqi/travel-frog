import type { CSSProperties, ReactNode } from 'react';
import type { FrogPerch } from '../../domain/home/perch';
import { PERCH_LABELS } from '../../domain/home/perch';
import type { BubblePlacement } from './layout';

export type FrogMode = 'rest' | 'postcard' | 'packing';

function FrogArt({ mode, charmCount }: { mode: FrogMode; charmCount: number }) {
  const postcard = mode === 'postcard';
  const packing = mode === 'packing';
  const charm = charmCount > 0;
  return (
    <svg viewBox="0 0 64 60">
      <ellipse cx="32" cy="52" rx="18" ry="3.6" fill="rgba(40,28,16,.28)" />
      <path d="M13 44c-5 1-7 5-4 7 2 1.6 7-1 9-5z" fill="#3E7D4C" />
      <path d="M51 44c5 1 7 5 4 7-2 1.6-7-1-9-5z" fill="#3E7D4C" />
      <path d="M10 37c0-9.6 9.8-17 22-17s22 7.4 22 17-9.8 14-22 14-22-4.4-22-14z" fill="#5FA36B" />
      <path d="M18 40c1-6 6.6-9.6 14-9.6S45 34 46 40c-1.6 4.4-7 6.4-14 6.4s-12.4-2-14-6.4z" fill="#79B986" opacity=".55" />
      <circle cx="22" cy="19" r="7" fill="#5FA36B" />
      <circle cx="42" cy="19" r="7" fill="#5FA36B" />
      <circle cx="22" cy="19" r="3.1" fill="#1E2E1F" />
      <circle cx="42" cy="19" r="3.1" fill="#1E2E1F" />
      <circle cx="23" cy="18" r="1" fill="#fff" />
      <circle cx="43" cy="18" r="1" fill="#fff" />
      <path d="M26 31c2.8 2.6 9.2 2.6 12 0" stroke="#2C4A2E" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M18 47l-3 6M46 47l3 6" stroke="#2C4A2E" strokeWidth="3" strokeLinecap="round" />
      {postcard ? (
        <g className="postcard-mini">
          <rect x="40" y="24" width="17" height="12" rx="1" fill="#FAF3E4" stroke="#8A7355" strokeWidth=".8" transform="rotate(-8 48 30)" />
          <path d="M42 27l7 4 6-5" stroke="#A8573F" strokeWidth=".8" fill="none" transform="rotate(-8 48 30)" />
        </g>
      ) : null}
      {packing ? (
        <g className="bag">
          <rect x="46" y="36" width="13" height="15" rx="3" fill="#B47712" />
          <path d="M49 36c0-4 6-4 6 0" stroke="#6E460B" strokeWidth="1.5" fill="none" />
          <path d="M46 41h13" stroke="#8E5C0D" strokeWidth="1.2" />
        </g>
      ) : null}
      {charm ? (
        <g className="frog-charm">
          <path d="M53 35c3.4 2.6 4 5.2 4 7.4" stroke="#7A5B36" strokeWidth="1.1" fill="none" strokeLinecap="round" />
          <circle cx="57" cy="45.2" r="3.1" fill="#C08A2E" stroke="#7A5B36" strokeWidth=".7" />
          <path d="M55.2 46.6h3.6" stroke="#7A5B36" strokeWidth=".6" />
          <circle cx="57" cy="48.4" r=".8" fill="#7A5B36" />
        </g>
      ) : null}
    </svg>
  );
}

/** The frog drawing on its own, for the home scene where placement is CSS-driven. */
export function FrogFigure({ mode = 'rest', charmCount = 0 }: { readonly mode?: FrogMode; readonly charmCount?: number }) {
  return (
    <div className="frog-figure">
      <FrogArt mode={mode} charmCount={charmCount} />
    </div>
  );
}

export function FrogNode({
  x,
  y,
  mode,
  charmCount,
  onClick,
}: {
  readonly x: number;
  readonly y: number;
  readonly mode: FrogMode;
  readonly charmCount: number;
  readonly onClick: () => void;
}) {
  const className = `frog${mode === 'postcard' ? ' state-postcard' : ''}${mode === 'packing' ? ' state-packing' : ''}`;
  return (
    <button
      type="button"
      className={className}
      style={{ left: `${x}px`, top: `${y}px` }}
      aria-label="青蛙 · 点击打开动作"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      <FrogArt mode={mode} charmCount={charmCount} />
    </button>
  );
}

const ICONS: Record<'replay' | 'entrust' | 'packing', ReactNode> = {
  replay: (
    <svg viewBox="0 0 20 20" width="15" height="15" fill="currentColor">
      <rect x="6" y="4.5" width="3" height="11" rx=".8" />
      <rect x="11" y="4.5" width="3" height="11" rx=".8" />
    </svg>
  ),
  entrust: (
    <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <rect x="2.6" y="5" width="14.8" height="10" rx=".8" />
      <path d="M3.4 6.2 10 11l6.6-4.8M10.4 15v-2.4M8 13.8h4.8" />
    </svg>
  ),
  packing: (
    <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <path d="M4 7.4h12v9H4z" />
      <path d="M7.4 7.4V5.2h5.2v2.2M4 11h12" />
    </svg>
  ),
};

export type FrogAction = 'replay' | 'entrust' | 'packing';

const ACTION_LABELS: Record<FrogAction, string> = {
  replay: '回放这趟旅行',
  entrust: '托付下一趟',
  packing: '收拾行李',
};

export function FrogActions({
  x,
  y,
  below,
  onAction,
}: {
  readonly x: number;
  readonly y: number;
  readonly below: boolean;
  readonly onAction: (action: FrogAction) => void;
}) {
  const style = { left: `${x}px`, top: `${y}px` } as CSSProperties;
  return (
    <div className={`frog-actions${below ? ' below' : ''}`} style={style} aria-label="青蛙动作">
      {(Object.keys(ACTION_LABELS) as FrogAction[]).map((action) => (
        <button key={action} type="button" title={ACTION_LABELS[action]} aria-label={ACTION_LABELS[action]} onClick={() => onAction(action)}>
          {ICONS[action]}
        </button>
      ))}
    </div>
  );
}

export function FrogBubble({
  placement,
  text,
  onDismiss,
}: {
  readonly placement: BubblePlacement;
  readonly text: string;
  readonly onDismiss: () => void;
}) {
  return (
    <div
      className={`frog-bubble${placement.flip ? ' flip' : ''}`}
      style={{ left: `${placement.x}px`, top: `${placement.y}px` }}
    >
      <span>{text}</span>
      <button className="bubble-x" type="button" aria-label="稍后提醒" onClick={onDismiss}>
        ×
      </button>
    </div>
  );
}

export interface ReplayState {
  readonly tripId: string;
  readonly cityName: string;
  readonly index: number;
  readonly total: number;
  readonly playing: boolean;
}

export function ReplayBar({
  replay,
  onPrev,
  onPlay,
  onNext,
  onClose,
}: {
  readonly replay: ReplayState;
  readonly onPrev: () => void;
  readonly onPlay: () => void;
  readonly onNext: () => void;
  readonly onClose: () => void;
}) {
  return (
    <div className="replay-bar">
      <div className="replay-info">
        <strong>{replay.cityName}</strong>
        <span>
          第 {replay.index + 1} / {replay.total} 站
        </span>
      </div>
      <div className="replay-actions">
        <button type="button" aria-label="上一站" onClick={onPrev}>
          <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            <path d="M12.5 5 7 10l5.5 5" />
          </svg>
        </button>
        <button type="button" aria-label={replay.playing ? '暂停' : '播放'} className={replay.playing ? 'is-playing' : ''} onClick={onPlay}>
          <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
            <rect x="6" y="4.5" width="3" height="11" rx=".8" />
            <rect x="11" y="4.5" width="3" height="11" rx=".8" />
          </svg>
        </button>
        <button type="button" aria-label="下一站" onClick={onNext}>
          <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            <path d="M7.5 5 13 10l-5.5 5" />
          </svg>
        </button>
      </div>
      <button className="replay-close" type="button" onClick={onClose}>
        结束回放
      </button>
    </div>
  );
}

const PERCH_POSE: Readonly<Record<FrogPerch, string>> = {
  armchair: 'sit', 'fireplace-rug': 'stand', curio: 'look-up', bookshelf: 'read', suitcase: 'walk', footstool: 'doze',
};

export function FrogPerchFigure({ perch }: { readonly perch: FrogPerch }) {
  return <span className={`frog-sprite pose-${PERCH_POSE[perch]}`} role="img" aria-label={`青蛙 · ${PERCH_LABELS[perch]}`}/>;
}
