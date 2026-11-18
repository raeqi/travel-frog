import type { CSSProperties, ReactNode } from 'react';
import type { FrogPerch } from '../../domain/home/perch';
import { PERCH_LABELS } from '../../domain/home/perch';
import type { BubblePlacement } from './layout';
import { FROG_POSE_LABELS, PERCH_POSE, type FrogPose } from './frog-poses';

export type FrogMode = 'rest' | 'postcard' | 'packing';

function FrogArt({ mode, charmCount }: { mode: FrogMode; charmCount: number }) {
  const pose: FrogPose = mode === 'postcard' ? 'placard' : mode === 'packing' ? 'box' : 'front';
  return (
    <span className="frog-map-art" aria-hidden="true">
      <span className={`frog-sprite pose-${pose}`} />
      {charmCount > 0 ? <span className="frog-map-charm" /> : null}
    </span>
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
  replay: '回放我的照片旅程',
  entrust: '给下一趟留方向',
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

export function FrogPerchFigure({ perch, pose = PERCH_POSE[perch], locationLabel = PERCH_LABELS[perch] }: { readonly perch: FrogPerch; readonly pose?: FrogPose; readonly locationLabel?: string }) {
  return <span className={`frog-sprite pose-${pose}`} role="img" aria-label={`青蛙 · ${locationLabel} · ${FROG_POSE_LABELS[pose]}`}/>;
}
