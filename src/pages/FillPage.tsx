import { useEffect, useMemo, useState } from 'react';
import type { Photo, Trip, Visit } from '../types';
import { useStore } from '../state';
import { navigate, routePath } from '../lib/router';
import { dayKey, fmtDate, fmtMonthDay, fmtTime } from '../lib/format';
import { latestTrip, missingPhotosOfTrip, photosOfTrip } from '../lib/selectors';
import { nearestCity, timezoneOffsetFor, formatCoord } from '../lib/geo';
import { PhotoThumb } from '../components/PhotoThumb';

interface CandidatePlace {
  key: string;
  label: string;
  lat: number;
  lng: number;
  sourceAt: number;
}

function visitLabels(trip: Trip): Map<string, string> {
  const map = new Map<string, string>();
  for (const v of trip.visits) map.set(v.id, v.name);
  return map;
}

function labelOf(photo: Photo, labels: Map<string, string>): string {
  if (photo.visitId && labels.has(photo.visitId)) return labels.get(photo.visitId) as string;
  if (photo.placeLabel) return photo.placeLabel;
  return nearestCity(photo.lat as number, photo.lng as number)?.city ?? '未识别地点';
}

function placesByDay(located: Photo[], labels: Map<string, string>): Map<string, CandidatePlace[]> {
  const days = new Map<string, Photo[]>();
  for (const p of located) {
    const key = dayKey(p.takenAt);
    const list = days.get(key) ?? [];
    list.push(p);
    days.set(key, list);
  }
  const out = new Map<string, CandidatePlace[]>();
  for (const [day, photos] of days) {
    const groups = new Map<string, Photo[]>();
    for (const p of photos) {
      const label = labelOf(p, labels);
      const g = groups.get(label) ?? [];
      g.push(p);
      groups.set(label, g);
    }
    const places: CandidatePlace[] = [];
    for (const [label, group] of groups) {
      const lat = group.reduce((s, p) => s + (p.lat as number), 0) / group.length;
      const lng = group.reduce((s, p) => s + (p.lng as number), 0) / group.length;
      places.push({
        key: `${lat.toFixed(4)},${lng.toFixed(4)},${label}`,
        label,
        lat,
        lng,
        sourceAt: Math.max(...group.map((p) => p.takenAt)),
      });
    }
    places.sort((a, b) => b.sourceAt - a.sourceAt);
    out.set(day, places);
  }
  return out;
}

function defaultPlace(photo: Photo, located: Photo[], dayPlaces: Map<string, CandidatePlace[]>, labels: Map<string, string>): CandidatePlace | null {
  const places = dayPlaces.get(dayKey(photo.takenAt));
  if (places?.length) {
    let best = places[0];
    let bestDiff = Infinity;
    for (const place of places) {
      const diff = Math.abs(place.sourceAt - photo.takenAt);
      if (diff < bestDiff) {
        best = place;
        bestDiff = diff;
      }
    }
    return best;
  }
  let nearest: Photo | null = null;
  let nearestDiff = Infinity;
  for (const p of located) {
    const diff = Math.abs(p.takenAt - photo.takenAt);
    if (diff < nearestDiff) {
      nearest = p;
      nearestDiff = diff;
    }
  }
  if (!nearest) return null;
  const label = labelOf(nearest, labels);
  return {
    key: `${(nearest.lat as number).toFixed(4)},${(nearest.lng as number).toFixed(4)},${label}`,
    label,
    lat: nearest.lat as number,
    lng: nearest.lng as number,
    sourceAt: nearest.takenAt,
  };
}

function PreviewMap({ visits, place }: { visits: Visit[]; place: CandidatePlace | null }) {
  const W = 360;
  const H = 276;
  const pts = visits.filter((v) => v.lat != null && v.lng != null).map((v) => ({ lat: v.lat as number, lng: v.lng as number }));
  if (place) pts.push({ lat: place.lat, lng: place.lng });
  if (!pts.length) return null;
  const midLat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
  const k = Math.max(0.2, Math.cos((midLat * Math.PI) / 180));
  const xs = pts.map((p) => p.lng * k);
  const ys = pts.map((p) => -p.lat);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 1e-5);
  const spanY = Math.max(maxY - minY, 1e-5);
  const pad = 54;
  const scale = Math.min((W - pad * 2) / spanX, (H - pad * 2) / spanY);
  const ox = (W - spanX * scale) / 2;
  const oy = (H - spanY * scale) / 2;
  const xy = (lat: number, lng: number) => ({
    x: ox + (lng * k - minX) * scale,
    y: oy + (-lat - minY) * scale,
  });
  const vpts = visits.filter((v) => v.lat != null && v.lng != null).map((v) => xy(v.lat as number, v.lng as number));
  const pin = place ? xy(place.lat, place.lng) : null;
  const path = vpts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="候选地点落点预览">
      <rect width={W} height={H} fill="#f6f6f6" />
      <g stroke="#e4e4e4" strokeWidth="1">
        {[1, 2, 3, 4].map((i) => <line key={`h${i}`} x1="0" y1={(H / 5) * i} x2={W} y2={(H / 5) * i} />)}
        {[1, 2, 3, 4, 5].map((i) => <line key={`v${i}`} x1={(W / 6) * i} y1="0" x2={(W / 6) * i} y2={H} />)}
      </g>
      {path ? <path d={path} fill="none" stroke="#b5b5b5" strokeWidth="1.4" strokeDasharray="4 4" /> : null}
      {vpts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill="#9a9a9a" />)}
      {pin ? (
        <>
          <circle className="preview-ring" cx={pin.x} cy={pin.y} r="24" />
          <circle className="preview-pin" cx={pin.x} cy={pin.y} r="6.5" />
          <text
            className="loc-map-label"
            x={pin.x > W - 110 ? pin.x - 16 : pin.x + 16}
            y={pin.y + 4}
            style={{ textAnchor: pin.x > W - 110 ? 'end' : 'start' }}
          >
            {place?.label}
          </text>
        </>
      ) : null}
      <text className="geo-label" x="16" y={H - 16}>CANDIDATE PIN</text>
    </svg>
  );
}

export function FillPage({ tripId }: { tripId?: string }) {
  const { data, fillPhotos, shiftTime, notify } = useStore();
  const trip = useMemo(
    () => data.trips.find((t) => t.id === tripId) ?? latestTrip(data),
    [data, tripId],
  );
  const missing = useMemo(() => (trip ? missingPhotosOfTrip(data, trip.id) : []), [data, trip]);
  const located = useMemo(
    () => (trip ? photosOfTrip(data, trip.id).filter((p) => p.lat != null && p.lng != null && !p.ignored) : []),
    [data, trip],
  );
  const labels = useMemo(() => (trip ? visitLabels(trip) : new Map<string, string>()), [trip]);
  const dayPlaces = useMemo(() => placesByDay(located, labels), [located, labels]);
  const days = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of missing) {
      const key = dayKey(p.takenAt);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [missing]);

  const [day, setDay] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [batchKey, setBatchKey] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    setSelected(new Set(missing.map((p) => p.id)));
    setOverrides({});
    setDay('all');
    setActiveId(missing[0]?.id ?? null);
  }, [trip?.id]);

  const allPlaces = useMemo(() => {
    const map = new Map<string, CandidatePlace>();
    for (const list of dayPlaces.values()) for (const place of list) map.set(place.key, place);
    return Array.from(map.values());
  }, [dayPlaces]);

  if (!trip) {
    return (
      <section className="screen is-active" id="screen-fill">
        <div className="fillpage-wrap">
          <div className="empty-map" style={{ display: 'flex', minHeight: 420 }}>
            <div className="empty-mark">＋</div>
            <h2>还没有可补齐的 Trip</h2>
            <p>先导入照片并确认候选，再来处理无定位照片。</p>
            <button className="btn btn-primary" type="button" onClick={() => navigate(routePath('import'))}>导入照片</button>
          </div>
        </div>
      </section>
    );
  }

  const visible = missing.filter((p) => day === 'all' || dayKey(p.takenAt) === day);

  const placeFor = (photo: Photo): CandidatePlace | null => {
    const key = overrides[photo.id];
    if (key) {
      const found = allPlaces.find((p) => p.key === key);
      if (found) return found;
    }
    return defaultPlace(photo, located, dayPlaces, labels);
  };

  const activePhoto = missing.find((p) => p.id === activeId) ?? visible[0] ?? null;
  const activePlace = activePhoto ? placeFor(activePhoto) : null;
  const selectedVisible = visible.filter((p) => selected.has(p.id));

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applyBatch = () => {
    if (!batchKey || !selectedVisible.length) {
      notify('先选一个候选地点，并勾选要套用的照片');
      return;
    }
    setOverrides((prev) => {
      const next = { ...prev };
      for (const p of selectedVisible) next[p.id] = batchKey;
      return next;
    });
    notify(`已把 ${selectedVisible.length} 张照片统一归到候选地点`);
  };

  const fixTimezone = () => {
    if (!selectedVisible.length) {
      notify('先勾选要按时区修正的照片');
      return;
    }
    let total = 0;
    let offsetUsed = 0;
    for (const p of selectedVisible) {
      const place = placeFor(p);
      if (!place) continue;
      const offset = timezoneOffsetFor(place.lng);
      if (!offset) continue;
      shiftTime(trip.id, [p.id], offset);
      total += 1;
      offsetUsed = offset;
    }
    notify(total ? `已按 UTC${offsetUsed >= 0 ? '+' : ''}${offsetUsed} 修正 ${total} 张照片的拍摄时间` : '没有可修正的照片');
  };

  const ignoreSelected = () => {
    if (!selectedVisible.length) {
      notify('先勾选要忽略的照片');
      return;
    }
    fillPhotos(trip.id, [], selectedVisible.map((p) => p.id));
    notify(`已忽略 ${selectedVisible.length} 张无定位照片，可稍后重新处理`);
  };

  const confirm = () => {
    const updates: { id: string; lat: number; lng: number; placeLabel: string }[] = [];
    for (const p of selectedVisible) {
      const place = placeFor(p);
      if (!place) continue;
      updates.push({ id: p.id, lat: place.lat, lng: place.lng, placeLabel: place.label });
    }
    if (!updates.length) {
      notify('还没有可确认的候选地点');
      return;
    }
    fillPhotos(trip.id, updates, []);
    notify(`已补齐 ${updates.length} 张照片的位置，站点索引已重建`);
  };

  const batchOptions = day === 'all' ? allPlaces : dayPlaces.get(day) ?? [];

  return (
    <section className="screen is-active" id="screen-fill">
      <div className="fillpage-wrap">
        <div className="fillpage-head">
          <div className="page-title-block">
            <div className="title-line">
              <span className="priority p1">P1</span>
              <h1>照片补位置</h1>
              <span className="chip">{missing.length} 张待补齐</span>
            </div>
            <p className="page-desc">这些照片没有位置信息，选一个候选地点或按天批量修正；候选来自同一天有 GPS 的照片。</p>
          </div>
          <span className="page-step">Trip · {trip.title}</span>
        </div>

        <div className="fillpage-grid">
          <section className="panel fillpage-main" aria-label="无定位照片列表">
            <div className="fillpage-toolbar">
              <span className="toolbar-label">按天调整</span>
              <div className="fill-days" role="tablist" aria-label="按天筛选">
                <button className={`fill-day-tab ${day === 'all' ? 'is-active' : ''}`} type="button" onClick={() => { setDay('all'); setBatchKey(''); }}>
                  全部 <span className="mono">{missing.length}</span>
                </button>
                {days.map(([key, count]) => (
                  <button
                    key={key}
                    className={`fill-day-tab ${day === key ? 'is-active' : ''}`}
                    type="button"
                    onClick={() => { setDay(key); setBatchKey(''); }}
                  >
                    {fmtMonthDay(new Date(`${key}T12:00:00`).getTime())} <span className="mono">{count}</span>
                  </button>
                ))}
              </div>
              <span className="toolbar-sep" />
              <button className="btn btn-xs" type="button" onClick={fixTimezone}>按时区修正</button>
              <span className="toolbar-sep" />
              <select
                className="fill-place"
                aria-label="批量候选地点"
                value={batchKey}
                onChange={(e) => setBatchKey(e.target.value)}
                style={{ width: 160, height: 26, fontSize: 10 }}
              >
                <option value="">选择候选地点</option>
                {batchOptions.map((place) => (
                  <option key={place.key} value={place.key}>{place.label}</option>
                ))}
              </select>
              <button className="btn btn-xs" type="button" onClick={applyBatch}>批量套用</button>
              <button className="btn btn-xs" type="button" onClick={ignoreSelected}>忽略已选</button>
            </div>

            <div className="fillpage-list-head">
              <span />
              <span>照片</span>
              <span>拍摄时间</span>
              <span>文件名</span>
              <span>候选地点</span>
            </div>
            <div className="fillpage-list">
              {visible.map((photo) => {
                const place = placeFor(photo);
                const rowDay = dayKey(photo.takenAt);
                const options = dayPlaces.get(rowDay) ?? [];
                return (
                  <div
                    key={photo.id}
                    className={`fillpage-row ${activeId === photo.id ? 'is-selected' : ''}`}
                    onClick={() => setActiveId(photo.id)}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(photo.id)}
                      aria-label={`选择 ${photo.name}`}
                      onChange={() => toggle(photo.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <PhotoThumb className="fill-thumb photo" thumb={photo.thumb} label="IMG" alt={photo.name} />
                    <span className="ff-time">{fmtDate(photo.takenAt)} {fmtTime(photo.takenAt)}</span>
                    <span className="ff-name">{photo.name}</span>
                    <select
                      className="fill-place"
                      aria-label={`${photo.name} 的候选地点`}
                      value={place?.key ?? ''}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setOverrides((prev) => ({ ...prev, [photo.id]: e.target.value }))}
                    >
                      {!options.length && <option value="">无同日候选</option>}
                      {options.map((o) => (
                        <option key={o.key} value={o.key}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
              {!visible.length && (
                <div className="cand-empty" style={{ margin: 12 }}>
                  {missing.length ? '这一天的无定位照片都处理完了。' : '这趟照片的位置都齐了。'}
                </div>
              )}
            </div>
            <div className="fillpage-foot">
              <span className="hint">没有位置的照片不会丢：默认留在 Trip 的「未定位」分组，补齐后才进入按天路线。</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span className="fill-count">已选 {selectedVisible.length} / {visible.length} 张</span>
                <button className="btn btn-primary btn-sm" type="button" disabled={!selectedVisible.length} onClick={confirm}>确认补齐</button>
              </div>
            </div>
          </section>

          <aside className="panel loc-preview" aria-label="地点落点预览">
            <div className="photos-head">
              <h2>落点预览</h2>
              <span className="hint mono">{activePhoto?.name ?? '—'}</span>
            </div>
            <div className="loc-map">
              <PreviewMap visits={trip.visits} place={activePlace} />
            </div>
            <div className="loc-info">
              <div><span>候选地点</span><b>{activePlace?.label ?? '暂无候选'}</b></div>
              <div><span>来源</span><b>{activePlace ? `${fmtDate(activePlace.sourceAt)} 有定位照片` : '同一天没有 GPS 照片'}</b></div>
              <div><span>时区</span><b>{activePlace ? `UTC${timezoneOffsetFor(activePlace.lng) >= 0 ? '+' : ''}${timezoneOffsetFor(activePlace.lng)}` : '—'}</b></div>
              <div><span>坐标</span><b className="mono">{activePlace ? formatCoord(activePlace.lat, activePlace.lng) : '—'}</b></div>
            </div>
            <div className="loc-note">
              预览只显示候选落点，不修改照片文件。确认后会写入 Trip 的站点索引，并标注「位置由同日照片推断」。精确坐标只留在本地。
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
