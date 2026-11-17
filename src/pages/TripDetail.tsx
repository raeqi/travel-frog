import { useEffect, useMemo, useState } from 'react';
import type { Trip, Visit } from '../types';
import { useStore } from '../state';
import { navigate, routePath } from '../lib/router';
import { fmtMonthDay, fmtRange, fmtTime, dayKey } from '../lib/format';
import { latestTrip, missingPhotosOfTrip, photosOfTrip } from '../lib/selectors';
import { PhotoThumb } from '../components/PhotoThumb';

const MAP_W = 760;
const MAP_H = 560;
const PAD = 96;

function localRoute(visits: Visit[]) {
  const located = visits.filter((v) => v.lat != null && v.lng != null);
  if (!located.length) return null;
  const midLat = located.reduce((s, v) => s + (v.lat as number), 0) / located.length;
  const k = Math.max(0.2, Math.cos((midLat * Math.PI) / 180));
  const xs = located.map((v) => (v.lng as number) * k);
  const ys = located.map((v) => -(v.lat as number));
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 1e-6);
  const spanY = Math.max(maxY - minY, 1e-6);
  const scale = Math.min((MAP_W - PAD * 2) / spanX, (MAP_H - PAD * 2) / spanY);
  const offsetX = (MAP_W - spanX * scale) / 2;
  const offsetY = (MAP_H - spanY * scale) / 2;
  const points = located.map((v) => ({
    visit: v,
    x: offsetX + ((v.lng as number) * k - minX) * scale,
    y: offsetY + (-(v.lat as number) - minY) * scale,
  }));
  return { points };
}

function TripRouteMap({ visits, active }: { visits: Visit[]; active: number }) {
  const route = useMemo(() => localRoute(visits), [visits]);
  if (!route) {
    return (
      <div className="empty-map" style={{ display: 'flex', height: '100%' }}>

        <div className="empty-mark">＋</div>
        <h2>这趟还没有位置</h2>
        <p>照片缺少 GPS，补齐后这里会出现站点路线。</p>
      </div>
    );
  }
  const path = route.points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
  const current = route.points[Math.min(active, route.points.length - 1)];

  return (
    <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} role="img" aria-label="站点路线示意图">
      <rect width={MAP_W} height={MAP_H} fill="#f6f6f6" />
      <g stroke="#e4e4e4" strokeWidth="1">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <line key={`h${i}`} x1="0" y1={(MAP_H / 7) * i} x2={MAP_W} y2={(MAP_H / 7) * i} />
        ))}
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <line key={`v${i}`} x1={(MAP_W / 8) * i} y1="0" x2={(MAP_W / 8) * i} y2={MAP_H} />
        ))}
      </g>
      <path className="detail-route-line soft" d={path} fill="none" transform="translate(3 3)" />
      <path className="detail-route-line" d={path} fill="none" />
      {route.points.map((p, i) => {
        const isActive = i === Math.min(active, route.points.length - 1);
        const anchor = p.x > MAP_W * 0.62 ? 'end' : 'start';
        const dx = anchor === 'end' ? -19 : 19;
        return (
          <g key={p.visit.id} className={`map-stop ${isActive ? 'is-active' : ''}`}>
            <circle cx={p.x} cy={p.y} r={isActive ? 15 : 12} />
            <text x={p.x} y={p.y + 0.5}>{i + 1}</text>
            {isActive && (
              <>
                <text className="stop-label" x={p.x + dx} y={p.y + 1} style={{ textAnchor: anchor }}>{p.visit.name}</text>
                <text className="stop-label" x={p.x + dx} y={p.y + 15} style={{ textAnchor: anchor, fontSize: 9, fill: '#999' }}>
                  {fmtMonthDay(p.visit.startAt)} {fmtTime(p.visit.startAt)}
                </text>
              </>
            )}
          </g>
        );
      })}
      {current ? (
        <g className="map-halo" aria-hidden="true">
          <circle cx={current.x} cy={current.y} r="21" className="city-halo" />
        </g>
      ) : null}
      <text className="geo-label" x="24" y={MAP_H - 22}>OFFLINE SKETCH · CITY LEVEL</text>
      <text className="geo-label" x={MAP_W - 24} y={MAP_H - 22} style={{ textAnchor: 'end' }}>
        {route.points.length} STOPS
      </text>
    </svg>
  );
}

export function TripDetailPage({ tripId }: { tripId?: string }) {
  const { data, saveMemory, notify } = useStore();
  const trip = useMemo<Trip | undefined>(
    () => data.trips.find((t) => t.id === tripId) ?? latestTrip(data),
    [data, tripId],
  );
  const [active, setActive] = useState(0);
  const [memory, setMemory] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setActive(0);
    setMemory(trip?.memory ?? '');
    setSaved(false);
  }, [trip?.id, trip?.memory]);

  const photos = useMemo(() => (trip ? photosOfTrip(data, trip.id) : []), [data, trip]);
  const missing = useMemo(() => (trip ? missingPhotosOfTrip(data, trip.id) : []), [data, trip]);

  if (!trip) {
    return (
      <section className="screen is-active" id="screen-detail">
        <div className="detail-wrap">
          <div className="empty-map" style={{ display: 'flex', minHeight: 420 }}>
            <div className="empty-mark">＋</div>
            <h2>还没有可打开的 Trip</h2>
            <p>导入照片并确认候选后，行程详情会出现在这里。</p>
            <button className="btn btn-primary" type="button" onClick={() => navigate(routePath('import'))}>导入照片</button>
          </div>
        </div>
      </section>
    );
  }

  const activeVisit = trip.visits[Math.min(active, Math.max(0, trip.visits.length - 1))];
  const missingByDay = new Map<string, number>();
  for (const p of missing) {
    const key = dayKey(p.takenAt);
    missingByDay.set(key, (missingByDay.get(key) ?? 0) + 1);
  }

  const doSave = () => {
    saveMemory(trip.id, memory.trim());
    setSaved(true);
    notify(memory.trim() ? '已保存这一句话记忆' : '已清空这一句话记忆');
  };

  return (
    <section className="screen is-active" id="screen-detail">
      <div className="detail-wrap">
        <div className="detail-head">
          <div>
            <div className="crumb">
              <button className="link-btn" type="button" onClick={() => navigate(routePath('home'))}>我的地图</button>
              <span>/</span>
              <span>Trip</span>
            </div>
            <div className="detail-title-row">
              <span className="priority p0">P0</span>
              <h1>{trip.title}</h1>
              <span className="chip is-ok">已确认</span>
            </div>
            <div className="detail-meta">
              <span className="mono">{fmtRange(trip.startAt, trip.endAt)}</span>
              <span>{trip.cityNames.length} 城</span>
              <span>{trip.visits.length} 站</span>
              <span>{photos.length} 张照片</span>
              <span className={`pending-flag ${missing.length ? '' : 'is-done'}`}>
                {missing.length ? `${missing.length} 张无定位，待补齐` : '位置已齐'}
              </span>
            </div>
          </div>
          <div className="detail-head-actions">
            <button className="btn" type="button" onClick={() => navigate(routePath('import'))}>重新导入</button>
            <button className="btn btn-primary" type="button" onClick={() => navigate(routePath('replay', trip.id))}>回放这趟</button>
          </div>
        </div>

        <div className="detail-grid">
          <aside className="panel visits-panel">
            <div className="visits-head">
              <h2>站点 · Visit</h2>
              <span>{trip.visits.length} STOPS</span>
            </div>
            <div className="visits">
              {trip.visits.map((visit, i) => {
                const sameDayMissing = missingByDay.get(dayKey(visit.startAt)) ?? 0;
                return (
                  <article
                    key={visit.id}
                    className={`visit ${i === active ? 'is-active' : ''}`}
                    onClick={() => setActive(i)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActive(i); } }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="visit-time">
                      <b>DAY {Math.floor((visit.startAt - trip.startAt) / 86_400_000) + 1}</b>
                      <span>{fmtMonthDay(visit.startAt)}</span>
                      <span>{fmtTime(visit.startAt)}</span>
                    </div>
                    <div className="visit-main">
                      <i className="visit-dot" />
                      <h3>{visit.name}</h3>
                      <p>
                        到达 {fmtTime(visit.startAt)} · <span className="visit-photos">{visit.photoCount} 张照片</span>
                      </p>
                      <p className="visit-summary">{visit.city}{visit.country && visit.country !== '—' ? ` · ${visit.country}` : ''} · 停留 {Math.max(1, Math.round((visit.endAt - visit.startAt) / 3_600_000))} 小时</p>
                      {sameDayMissing > 0 && (
                        <div className="visit-warn">
                          <span className="warn-text">当天无定位照片 {sameDayMissing} 张，待补充</span>
                          <button
                            className="btn btn-xs"
                            type="button"
                            onClick={(e) => { e.stopPropagation(); navigate(routePath('fill', trip.id)); }}
                          >
                            一键补齐
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
              {!trip.visits.length && (
                <div className="cand-empty" style={{ margin: 12 }}>这趟还没有带位置的照片，站点会在补位置后生成。</div>
              )}
            </div>
          </aside>

          <section className="panel detail-map-panel" aria-label="路线轨迹">
            <div className="detail-map-head">
              <h2>路线轨迹</h2>
              <span className="map-active">当前站点 · {activeVisit?.name ?? '未选择'}</span>
            </div>
            <div className="detail-map-body">
              <TripRouteMap visits={trip.visits} active={active} />
            </div>
            <div className="detail-map-foot">
              <span><i className="legend-line" />{trip.cityNames.join(' → ') || '未识别路线'}</span>
              <span>{trip.visits.length} 站 · 离线示意图</span>
            </div>
          </section>

          <aside className="panel side-panel" aria-label="照片流与一句话记忆">
            <div className="photos-head">
              <h2>照片流 · {photos.length}</h2>
              <span className="hint mono">本地缩略图</span>
            </div>
            <div className="photo-stream">
              {photos.slice(0, 9).map((photo) => (
                <PhotoThumb
                  key={photo.id}
                  className="thumb"
                  thumb={photo.thumb}
                  label={photo.ignored ? '已忽略' : '无缩略图'}
                  alt={photo.name}
                />
              ))}
              {!photos.length && <div className="hint">这趟还没有照片。</div>}
            </div>
            <div className="memory-box">
              <label htmlFor="memoryInput">一句话记忆 <small>会出现在回放里</small></label>
              <textarea
                id="memoryInput"
                maxLength={60}
                placeholder="写一句这趟旅行最想记住的话…"
                value={memory}
                onChange={(e) => { setMemory(e.target.value); setSaved(false); }}
              />
              <div className="memory-foot">
                <span>{memory.length} / 60 · 只保存在本地</span>
                <button className="btn btn-xs" type="button" onClick={doSave}>{saved ? '已保存' : '保存'}</button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
