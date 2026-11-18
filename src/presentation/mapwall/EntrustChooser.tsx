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
        <h2 id="entrust-title">让蛙蛙从哪里寄一张？</h2>
        <button ref={closeRef} type="button" className="entrust-close" onClick={onClose} aria-label="取消托付">×</button>
      </div>
      <p id="entrust-description">点下面的目的地即可托付，约 6 秒收到来信。也可以点地图上的同名标签。</p>
      <div className="entrust-options">
        {destinations.map(destination => (
          <button key={destination.key} type="button" disabled={busy !== null} onClick={() => onSelect(destination)} aria-label={`托付 · ${destination.name}`}>
            <strong>{destination.name}</strong><span>{destination.country}</span>
            <em>{busy === destination.key ? '正在托付…' : '托付 →'}</em>
          </button>
        ))}
      </div>
      {destinations.length === 0 ? <p className="entrust-empty">这些目的地都已有足迹或明信片，暂时没有新的可选地点。</p> : null}
      <p className="entrust-foot">这是蛙蛙寄给你的本机模拟来信，不会发送给其他人。</p>
    </section>
  );
}
