import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from '../state';
import { navigate, routePath } from '../lib/router';
import { latestTrip } from '../lib/selectors';
import { fmtDate, fmtTime } from '../lib/format';
import { FrogIcon } from '../components/FrogIcon';

export function ReplayPage({ tripId }: { tripId?: string }) {
  const { data } = useStore();
  const trip = useMemo(
    () => data.trips.find((t) => t.id === tripId) ?? latestTrip(data),
    [data, tripId],
  );
  const [index, setIndex] = useState(0);

  const stops = trip?.visits ?? [];
  const count = stops.length;

  useEffect(() => {
    setIndex(0);
  }, [trip?.id]);

  const move = useCallback((next: number) => {
    setIndex((prev) => {
      const target = typeof next === 'number' ? next : prev;
      return Math.max(0, Math.min(count - 1, target));
    });
  }, [count]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
      else if (e.key === 'ArrowRight') setIndex((i) => Math.min(count - 1, i + 1));
      else if (e.key === 'Escape' && trip) navigate(routePath('trip', trip.id));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count, trip]);

  if (!trip || !count) {
    return (
      <section className="screen is-active" id="screen-replay">
        <div className="replay-scene">
          <div className="replay-top">
            <div className="replay-top-left">
              <button className="btn btn-sm" type="button" onClick={() => navigate(routePath('trip', trip?.id))}>← 退出回放</button>
              <span className="priority p0">P0</span>
            </div>
            <span className="replay-trip">TRIP · 回放</span>
          </div>
          <div className="replay-stage">
            <div className="empty-map" style={{ display: 'flex', color: '#9a9a9a' }}>
              <div className="empty-mark">＋</div>
              <h2 style={{ color: '#e6e6e6' }}>{trip ? '这趟还没有站点' : '还没有可回放的 Trip'}</h2>
              <p>{trip ? '补齐带 GPS 的照片后，回放会从第一站开始。' : '导入照片并确认候选后，就能重走这趟旅行。'}</p>
              <button className="btn btn-sm" type="button" onClick={() => navigate(routePath(trip ? 'fill' : 'import', trip?.id))}>
                {trip ? '去补位置' : '导入照片'}
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const stop = stops[Math.min(index, count - 1)];
  const photos = Object.values(data.photos)
    .filter((p) => p.visitId === stop.id && !p.ignored)
    .sort((a, b) => a.takenAt - b.takenAt);
  const cover = photos.find((p) => p.thumb)?.thumb;
  const memory = trip.memory || '在下一站之前，先记住这一站。';
  const progress = ((index + 1) / count) * 100;
  const frogLeft = count === 1 ? 0 : (index / (count - 1)) * 100;

  return (
    <section className="screen is-active" id="screen-replay">
      <div className="replay-scene">
        <div className="replay-top">
          <div className="replay-top-left">
            <button className="btn btn-sm" type="button" onClick={() => navigate(routePath('trip', trip.id))}>← 退出回放</button>
            <span className="priority p0">P0</span>
          </div>
          <span className="replay-trip">TRIP · {trip.title}</span>
          <span className="replay-count">第 {index + 1} / {count} 站</span>
        </div>

        <div className="replay-stage">
          <div className={`replay-photo ${cover ? 'has-img' : ''}`}>
            {cover ? <img src={cover} alt={`${stop.name} 的照片`} /> : null}
            <div className="rp-label">
              <b>{cover ? stop.name : '照片占位 · 16:9'}</b>
              <span>第 {index + 1} 站 · {fmtDate(stop.startAt)} {fmtTime(stop.startAt)} · {stop.photoCount} 张</span>
            </div>
          </div>
          <div className="replay-corner" aria-hidden="true">
            <FrogIcon className="frog-svg" />
            <div className="corner-cap">青蛙在 第 {index + 1} 站</div>
          </div>
        </div>

        <div className="replay-caption">
          <div className="replay-time">{fmtDate(stop.startAt)} · {fmtTime(stop.startAt)}</div>
          <h2 className="replay-place">{stop.name}</h2>
          <p className="hand">“{memory}”</p>
        </div>

        <div className="replay-controls">
          <button className="btn" type="button" disabled={index === 0} onClick={() => move(index - 1)}>上一站</button>
          <div className="route">
            <div className="route-line" />
            <div className="route-dots">
              {stops.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  className={`route-dot ${i === index ? 'is-active' : ''} ${i < index ? 'is-passed' : ''}`}
                  aria-label={`跳到第 ${i + 1} 站 ${s.name}`}
                  onClick={() => move(i)}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <div className="route-frog" style={{ left: `${frogLeft}%` }}>
              <FrogIcon className="frog-svg" />
            </div>
          </div>
          <button className="btn" type="button" disabled={index === count - 1} onClick={() => move(index + 1)}>下一站</button>
        </div>

        <div className="replay-progress">
          <span className="mono">第 {index + 1} / {count} 站</span>
          <div className="progress" role="progressbar" aria-label="回放进度" aria-valuemin={1} aria-valuemax={count} aria-valuenow={index + 1}>
            <i style={{ width: `${progress}%` }} />
          </div>
          <span className="mono">{photos.length} 张照片</span>
          <span className="key-hint">← → 切换 · Esc 退出</span>
        </div>
      </div>
    </section>
  );
}
