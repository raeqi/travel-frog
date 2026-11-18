import { useEffect, useRef } from 'react';
import type { DestinationCandidate } from './candidates';
import './entrust.css';

export function EntrustChooser({ destinations, busy, onSelect, onClose }: {
  readonly destinations: readonly DestinationCandidate[];
  readonly busy: string | null;
  readonly onSelect: (destination: DestinationCandidate) => void;
  readonly onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeRef.current?.focus(); }, []);
  return (
    <section className="entrust-chooser" role="dialog" aria-labelledby="entrust-title" aria-describedby="entrust-description" aria-busy={busy !== null}>
      <div className="entrust-heading">
        <h2 id="entrust-title">给蛙蛙的下一趟留个方向</h2>
        <button ref={closeRef} type="button" className="entrust-close" onClick={onClose} aria-label="取消托付">×</button>
      </div>
      <p id="entrust-description">蛙蛙会自己出门。想让它去这里，也可以点一个目的地：在家时为这一趟收拾行李，已经出门就留到下一趟。来信在旅行途中寄回，不再按 6 秒投递。</p>
      <div className="entrust-options">
        {destinations.map(destination => (
          <button key={destination.key} type="button" disabled={busy !== null} onClick={() => onSelect(destination)} aria-label={`托付 · ${destination.name}`}>
            <strong>{destination.name}</strong><span>{destination.country}</span>
            <em>{busy === destination.key ? '正在托付…' : '托付 →'}</em>
          </button>
        ))}
      </div>
      {destinations.length === 0 ? <p className="entrust-empty">这些目的地都已有足迹或明信片，暂时没有新的可选地点。</p> : null}
      <p className="entrust-foot">这是按日程推进的本机模拟旅行。自然节奏一趟数小时；在蛙蛙的旅行面板可以明确切换加速演示。</p>
    </section>
  );
}
