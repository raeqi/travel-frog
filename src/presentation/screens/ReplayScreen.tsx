import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useArchive } from '../context';
import { cityLabel, daysOf, fmtLocalMonthDay, fmtLocalTime } from '../format';
import { Icon } from '../icons';
import { navigate, tripHref, useRoute } from '../router';
import { memoryOf, offsetOfTrip, photosOfTrip, tripOf, visitsOfTrip } from '../selectors';
import { Badge, PhotoThumb } from '../ui';

const STOP_INTERVAL_MS = 4200;

export function ReplayScreen() {
  const snapshot = useArchive();
  const route = useRoute();
  const trip = tripOf(snapshot, route.tripId);
  const visits = useMemo(() => (trip ? visitsOfTrip(snapshot, trip.id) : []), [snapshot, trip]);
  const photos = useMemo(() => (trip ? photosOfTrip(snapshot, trip.id) : []), [snapshot, trip]);
  const memory = trip ? memoryOf(snapshot, trip) : null;
  const offset = useMemo(() => (trip ? offsetOfTrip(snapshot, trip.id) : null), [snapshot, trip]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    setIndex(0);
    setPlaying(false);
  }, [trip?.id]);

  useEffect(() => {
    if (index >= visits.length && visits.length > 0) setIndex(visits.length - 1);
  }, [index, visits.length]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setPlaying(false);
        setIndex((current) => Math.min(current + 1, Math.max(visits.length - 1, 0)));
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setPlaying(false);
        setIndex((current) => Math.max(current - 1, 0));
      } else if (event.key === 'Escape') {
        navigate(trip ? `trip/${encodeURIComponent(trip.id)}` : 'home');
      } else if (event.key === ' ') {
        event.preventDefault();
        setPlaying((current) => !current);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visits.length, trip]);

  useEffect(() => {
    if (!playing) {
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
      return;
    }
    if (visits.length === 0) return;
    if (index >= visits.length - 1) {
      setPlaying(false);
      return;
    }
    timer.current = window.setTimeout(() => setIndex((current) => Math.min(current + 1, visits.length - 1)), STOP_INTERVAL_MS);
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
    };
  }, [playing, index, visits.length]);

  if (snapshot.status === 'loading') {
    return <ReplayFrame><div className="state-page" style={{ color: '#EDF1EE' }}><span className="spinner" /><h1 style={{ color: '#EDF1EE' }}>正在准备回放</h1><p style={{ color: 'rgba(237,241,238,.66)' }}>读取站点、照片缩略图与一句话记忆…</p></div></ReplayFrame>;
  }

  if (!trip || visits.length === 0) {
    return (
      <ReplayFrame>
        <div className="state-page" style={{ color: '#EDF1EE' }}>
          <div className="big-icon" style={{ background: 'rgba(255,255,255,.06)', color: '#B4DFC0' }}><Icon name="route" /></div>
          <h1 style={{ color: '#EDF1EE' }}>这趟旅程没有可回放的站点</h1>
          <p style={{ color: 'rgba(237,241,238,.66)' }}>照片都在，但缺少 GPS，无法生成站点路线。给照片补位置后，青蛙就能沿着路线重走。</p>
          <div className="actions">
            <a className="btn btn-primary btn-lg" href={trip ? `#/fill/${encodeURIComponent(trip.id)}` : '#/fill'}>去补位置</a>
            <a className="btn btn-secondary btn-lg" href={trip ? tripHref(trip.id) : '#/home'} style={{ background: 'transparent', borderColor: 'rgba(255,255,255,.2)', color: '#EDF1EE' }}>返回旅程详情</a>
          </div>
          <div className="meta" style={{ color: 'rgba(237,241,238,.38)' }}>EMPTY_VISITS · 照片仍在 Trip 内</div>
        </div>
      </ReplayFrame>
    );
  }

  const current = visits[Math.min(index, visits.length - 1)];
  if (!current) return null;
  const visitPhotos = photos.filter((photo) => photo.visitId === current.id);
  const cover = visitPhotos[0] ?? photos[0];
  const percentValue = visits.length <= 1 ? 100 : (index / (visits.length - 1)) * 100;
  const exit = () => navigate(`trip/${encodeURIComponent(trip.id)}`);

  return (
    <section className="screen is-active" data-screen="replay">
      <div className="replay">
        <div className="replay-top">
          <a className="btn btn-sm" href={tripHref(trip.id)} onClick={exit}>
            <Icon name="arrow-left" className="icon icon-sm" />退出回放
          </a>
          <Badge tone="confirmed" dot>{playing ? '自动回放中' : '回放中'}</Badge>
          <span className="trip-name">TRIP · {trip.title}</span>
          <span className="spacer" />
          <span className="count">第 {index + 1} / {visits.length} 站</span>
          <button className="icon-btn" type="button" aria-label={playing ? '暂停自动播放' : '自动播放'} aria-pressed={playing} onClick={() => setPlaying(!playing)}>
            <Icon name={playing ? 'pause' : 'play'} />
          </button>
          <a className="btn btn-sm" href={tripHref(trip.id)} onClick={exit}>
            退出 <span className="kbd" style={{ background: 'rgba(255,255,255,.08)', borderColor: 'rgba(255,255,255,.18)', color: 'rgba(255,255,255,.7)' }}>Esc</span>
          </a>
        </div>

        <div className="replay-body">
          <div className="replay-stage-wrap">
            <div className="replay-stage">
              {cover ? <PhotoThumb photo={cover} className="replay-photo" alt={`${current.displayName} 的照片`} /> : <div className="ph ph--night"><span className="ph-art" /></div>}
              <div className="stage-label">第 {index + 1} 站 · {current.cityRef.name}</div>
              <svg className="replay-frog" viewBox="0 0 120 96" aria-hidden="true"><use href="#i-frog" /></svg>
            </div>
            <div className="replay-caption">
              <div className="time">{fmtLocalMonthDay(current.timeRange.start, offset)} · {fmtLocalTime(current.timeRange.start, offset)}</div>
              <h2 id="replay-place">{current.displayName}</h2>
              <p className="memory">
                {memory ? `“${memory.text}”` : `${current.cityRef.name} · 这趟旅程还没有写一句话记忆`}
              </p>
            </div>
            <div className="replay-controls">
              <button className="btn btn-sm" type="button" disabled={index === 0} onClick={() => { setPlaying(false); setIndex((value) => Math.max(0, value - 1)); }}>
                <Icon name="arrow-left" className="icon icon-sm" />上一站
              </button>
              <div className="replay-route">
                <div className="route-track">
                  <span className="fill" style={{ width: `${percentValue}%` }} />
                  <div id="routeStops">
                    {visits.map((visit, stopIndex) => (
                      <button
                        key={visit.id}
                        type="button"
                        aria-label={`跳到第 ${stopIndex + 1} 站 ${visit.displayName}`}
                        style={{
                          position: 'absolute',
                          left: `${visits.length <= 1 ? 0 : (stopIndex / (visits.length - 1)) * 100}%`,
                          top: '50%',
                          transform: 'translate(-50%, -50%)',
                          width: 14,
                          height: 14,
                          borderRadius: '50%',
                          border: 0,
                          padding: 0,
                          cursor: 'pointer',
                          background: stopIndex <= index ? 'var(--green-300)' : 'rgba(255,255,255,.28)',
                        }}
                        onClick={() => { setPlaying(false); setIndex(stopIndex); }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <button className="btn btn-sm" type="button" disabled={index >= visits.length - 1} onClick={() => { setPlaying(false); setIndex((value) => Math.min(visits.length - 1, value + 1)); }}>
                下一站<Icon name="arrow-right" className="icon icon-sm" />
              </button>
            </div>
            <div className="replay-progressline">
              <span className="mono">第 {index + 1} / {visits.length} 站</span>
              <div className="progress" role="progressbar" aria-label="回放进度" aria-valuemin={1} aria-valuemax={visits.length} aria-valuenow={index + 1}>
                <i style={{ width: `${percentValue}%` }} />
              </div>
              <span className="mono">{photos.length} 张照片</span>
              <span className="replay-keyhint"><span className="kbd">←</span><span className="kbd">→</span> 切换 <span className="kbd">空格</span> 自动播放 <span className="kbd">Esc</span> 退出</span>
            </div>
          </div>

          <aside className="replay-side" aria-label="旅程站点列表">
            <div className="eyebrow">ON THE ROAD</div>
            <h3>{trip.title}</h3>
            <div className="trip-meta">
              {fmtLocalMonthDay(trip.timeRange.start, offset)} → {fmtLocalMonthDay(trip.timeRange.end - 1, offset)} · {daysOf(trip.timeRange)} 天 · {cityLabel(trip.cityRefs, 2)} · {visits.length} 站 · {photos.length} 张<br />
              青蛙从第 {index + 1} 站开始，替你重走一遍。
            </div>
            <div className="stop-list">
              {visits.map((visit, stopIndex) => (
                <button key={visit.id} className={`stop-row${stopIndex === index ? ' is-active' : ''}`} type="button" onClick={() => { setPlaying(false); setIndex(stopIndex); }}>
                  <span className="n">{String(stopIndex + 1).padStart(2, '0')}</span>
                  <span className="nm">{visit.displayName}</span>
                  <span className="tm">{fmtLocalMonthDay(visit.timeRange.start, offset)} {fmtLocalTime(visit.timeRange.start, offset)}</span>
                </button>
              ))}
            </div>
            <div className="side-foot">
              <Icon name="keyboard" className="icon icon-xs" /> 方向键切站 · 空格自动播放 · Esc 回到旅程详情<br />
              回放不修改任何持久化数据
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

function ReplayFrame({ children }: { children: ReactNode }) {
  return (
    <section className="screen is-active" data-screen="replay">
      <div className="replay" style={{ display: 'grid', placeItems: 'center' }}>{children}</div>
    </section>
  );
}
