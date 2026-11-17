import { useMemo, useState } from 'react';
import { useStore } from '../state';
import { navigate, routePath } from '../lib/router';
import { fmtMonth, fmtRange } from '../lib/format';
import { latestTrip } from '../lib/selectors';
import { WorldMap, citiesFromTrips, COUNTRY_FILL, type MapCity } from '../components/WorldMap';

type Mode = 'time' | 'country';

function CityRow({
  city,
  selected,
  onSelect,
}: {
  city: MapCity;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li
      className={`city-row ${selected ? 'is-selected' : ''}`}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <i className="cdot" />
      <span className="cname">
        <b>{city.name}</b>
        <span className="cmeta">{city.country} · {city.trips} 趟 Trip</span>
      </span>
      <span className="cyear">{city.year}<br />{city.photos} 张</span>
    </li>
  );
}

export function MapPage() {
  const { data } = useStore();
  const [mode, setMode] = useState<Mode>('time');
  const [year, setYear] = useState('all');
  const [selected, setSelected] = useState<string | null>(null);

  const trips = useMemo(() => data.trips.slice().sort((a, b) => b.endAt - a.endAt), [data.trips]);
  const cities = useMemo(() => citiesFromTrips(trips, data.photos), [trips, data.photos]);
  const years = useMemo(
    () => Array.from(new Set(cities.map((c) => String(c.year)))).sort((a, b) => Number(b) - Number(a)),
    [cities],
  );
  const filtered = useMemo(
    () => cities.filter((c) => year === 'all' || String(c.year) === year),
    [cities, year],
  );
  const countries = useMemo(() => new Set(filtered.map((c) => c.code).filter(Boolean)).size, [filtered]);
  const latest = latestTrip(data);

  const groups = useMemo(() => {
    if (mode === 'time') return [{ key: '', label: '', items: filtered }];
    const byCountry = new Map<string, MapCity[]>();
    for (const city of filtered) {
      const list = byCountry.get(city.country) ?? [];
      list.push(city);
      byCountry.set(city.country, list);
    }
    return Array.from(byCountry.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .map(([country, items]) => ({ key: country, label: `${country} · ${items.length} 城`, items }));
  }, [filtered, mode]);

  const legend = useMemo(() => {
    const byCountry = new Map<string, { code: string; count: number }>();
    for (const c of filtered) {
      const found = byCountry.get(c.country);
      if (found) found.count += 1;
      else byCountry.set(c.country, { code: c.code, count: 1 });
    }
    return Array.from(byCountry.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 6);
  }, [filtered]);

  return (
    <section className="screen is-active" id="screen-map">
      <div className="mapx-wrap">
        <div className="mapx-head">
          <div className="page-title-block">
            <div className="title-line">
              <span className="priority p1">P1</span>
              <h1>我的地图</h1>
              <span className="chip">全屏版</span>
            </div>
            <p className="page-desc">已点亮的城市按国家着色；切换聚合方式，查看时间线或国家概览。</p>
          </div>
          <div className="mapx-actions">
            <div className="seg" role="group" aria-label="聚合方式">
              <button className={mode === 'time' ? 'is-active' : ''} type="button" onClick={() => setMode('time')}>按时间</button>
              <button className={mode === 'country' ? 'is-active' : ''} type="button" onClick={() => setMode('country')}>按国家</button>
            </div>
            <button className="btn btn-sm" type="button" disabled={!latest} onClick={() => latest && navigate(routePath('replay', latest.id))}>回放最近一趟</button>
          </div>
        </div>

        <div className="mapx-grid">
          <section className="panel mapx-canvas" aria-label="全屏世界地图">
            <div className="mapx-toolbar">
              <h2>世界足迹</h2>
              <span className="agg-note">
                {mode === 'country' ? '聚合：国家 · 按已点亮城市数排序' : '聚合：时间倒序 · 最近一趟在最前'}
              </span>
            </div>
            <div className="mapx-svg-wrap">
              {cities.length ? (
                <WorldMap
                  cities={filtered}
                  trips={trips.filter((t) => year === 'all' || String(new Date(t.endAt).getFullYear()) === year)}
                  selected={selected}
                  showRoutes
                  showLabels
                  onSelect={setSelected}
                  ariaLabel="世界足迹地图"
                />
              ) : (
                <div className="empty-map" style={{ display: 'flex', height: '100%' }}>
                  <div className="empty-mark">＋</div>
                  <h2>地图还没有点亮</h2>
                  <p>确认第一趟 Trip 后，城市会出现在这里。</p>
                  <button className="btn btn-primary" type="button" onClick={() => navigate(routePath('import'))}>导入照片</button>
                </div>
              )}
              <div className="mapx-note">离线世界底图 · 城市级位置 · 精确坐标不出设备</div>
              <div className="mapx-stat">
                <span>足迹总览</span>
                <strong>已点亮 {filtered.length} 城 / {countries} 国</strong>
                <span>{latest ? `最近更新 · ${fmtMonth(latest.endAt)}` : '还没有旅行记录'}</span>
              </div>
              {legend.length > 0 && (
                <div className="mapx-legend" aria-label="国家色例">
                  {legend.map(([country, info], i) => (
                    <span key={country}>
                      <i className="swatch" style={{ background: COUNTRY_FILL[i % COUNTRY_FILL.length] }} />
                      {country} {info.count}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>

          <aside className="panel mapx-side" aria-label="年份筛选与城市列表">
            <div className="mapx-side-head">
              <h2>年份</h2>
              <span>按旅行时间筛选</span>
            </div>
            <div className="year-chips">
              <button className={`year-chip ${year === 'all' ? 'is-active' : ''}`} type="button" onClick={() => setYear('all')}>全部</button>
              {years.map((y) => (
                <button key={y} className={`year-chip ${year === y ? 'is-active' : ''}`} type="button" onClick={() => setYear(y)}>{y}</button>
              ))}
            </div>
            <div className="mapx-side-head">
              <h2>城市 <span>{filtered.length}</span></h2>
              <span>{mode === 'country' ? '按国家分组' : '按时间倒序'}</span>
            </div>
            <ul className="city-list">
              {groups.map((group) => (
                <li key={group.key || 'all'} style={{ listStyle: 'none' }}>
                  {group.label ? <div className="city-group-label">{group.label}</div> : null}
                  <ul>
                    {group.items.map((city) => (
                      <CityRow
                        key={`${city.name}-${city.code}`}
                        city={city}
                        selected={selected === city.name}
                        onSelect={() => setSelected(city.name)}
                      />
                    ))}
                  </ul>
                </li>
              ))}
              {!filtered.length && <li className="city-group-label">这个年份还没有点亮的城市</li>}
            </ul>
            <div className="mapx-side-foot">
              <span>{filtered.length} 个城市 · {countries} 个国家</span>
              <span>{trips.length} 趟 Trip</span>
            </div>
          </aside>
        </div>
      </div>
      {latest ? (
        <div className="detail-map-foot" style={{ maxWidth: 1440, margin: '0 auto', padding: '0 24px 12px', borderTop: 0 }}>
          <span className="hint">最近一趟 · {latest.title}（{fmtRange(latest.startAt, latest.endAt)}）</span>
        </div>
      ) : null}
    </section>
  );
}
