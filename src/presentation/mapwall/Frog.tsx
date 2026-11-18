import { useState, type CSSProperties, type ReactNode } from 'react';
import type { FrogPerch } from '../../domain/home/perch';
import type { BubblePlacement } from './layout';
import { FrogGlyph, PERCH_POSE, type FrogPose } from './frogSkin';
import { prefersReducedMotion } from './courier';

export type FrogMode = 'rest' | 'postcard' | 'packing';

function poseForMode(mode: FrogMode): FrogPose {
  if (mode === 'postcard') return 'postcard';
  if (mode === 'packing') return 'packing';
  return 'front';
}

/** The frog drawing on its own, for the home scene where placement is CSS-driven. */
export function FrogFigure({ mode = 'rest', charmCount = 0 }: { readonly mode?: FrogMode; readonly charmCount?: number }) {
  return (
    <div className="frog-figure">
      <FrogGlyph pose={poseForMode(mode)} charm={charmCount > 0} />
    </div>
  );
}

export function FrogNode({
  x,
  y,
  mode,
  charmCount,
  hop = false,
  onClick,
}: {
  readonly x: number;
  readonly y: number;
  readonly mode: FrogMode;
  readonly charmCount: number;
  readonly hop?: boolean;
  readonly onClick: () => void;
}) {
  const className = `frog${mode === 'postcard' ? ' state-postcard' : ''}${mode === 'packing' ? ' state-packing' : ''}${hop ? ' is-happy' : ''}`;
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
      <FrogGlyph pose={poseForMode(mode)} charm={charmCount > 0} />
    </button>
  );
}

const ICONS: Record<'replay' | 'entrust' | 'packing', ReactNode> = {
  replay: (
    <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="3" y="4.2" width="14" height="10" rx="1.2" />
      <path d="M8.2 7.2v5.2l4.4-2.6z" fill="currentColor" stroke="none" />
    </svg>
  ),
  entrust: (
    <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <rect x="2.6" y="5" width="14.8" height="10" rx=".8" />
      <path d="M3.4 6.2 10 11l6.6-4.8" />
    </svg>
  ),
  packing: (
    <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <rect x="3.4" y="7" width="13.2" height="9" rx="1" />
      <path d="M7.2 7V5.2h5.6V7M3.4 11h13.2" />
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
  const [popped, setPopped] = useState<FrogAction | null>(null);
  return (
    <div className={`frog-actions${below ? ' below' : ''}${popped ? ' is-choosing' : ''}`} style={style} aria-label="青蛙动作">
      {(Object.keys(ACTION_LABELS) as FrogAction[]).map((action) => (
        <button
          key={action}
          type="button"
          className={popped === action ? 'is-pop' : popped ? 'is-dim' : ''}
          title={ACTION_LABELS[action]}
          aria-label={ACTION_LABELS[action]}
          onClick={() => {
            if (popped) return;
            if (prefersReducedMotion()) {
              onAction(action);
              return;
            }
            setPopped(action);
            window.setTimeout(() => onAction(action), 180);
          }}
        >
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

/** Home frog: one character-sheet pose per perch, about a quarter of the chair. */
export function FrogPerchFigure({ perch }: { readonly perch: FrogPerch }) {
  const pose = PERCH_POSE[perch];
  return (
    <div className={`frog-figure frog-pose-${pose}`}>
      <FrogGlyph pose={pose} />
    </div>
  );
}
