import { useMemo, useState } from 'react';
import type { CityStat } from '../../domain/services/statistics';
import { useArchive, useService } from '../context';
import { Icon } from '../icons';
import { footprintOf, tripYears } from '../selectors';
import { EmptyState, LoadingState, PageHead, Screen, useAction } from '../ui';
import { WorldMap } from '../WorldMap';

export function MapScreen() {
  const snapshot = useArchive();
  const service = useService();
  const { busy, run } = useAction();
  const [year, setYear] = useState<number | null>(null);
  const [view, setView] = useState<'map' | 'list'>('map');
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  const years = useMemo(() => tripYears(snapshot), [snapshot]);
  const footprint = useMemo(() => footprintOf(snapshot, year), [snapshot, year]);
  const yearCounts = useMemo(
    () => new Map(years.map((item) => [item, footprintOf(snapshot, item).cityCount])),
    [snapshot, years],
  );
  const visitedCountries = useMemo(() => new Set(footprint.cities.map((city) => city.countryCode)), [footprint.cities]);
  const countries = useMemo(() => groupCountries(footprint.cities), [footprint.cities]);
  const selected = footprint.cities.find((city) => city.cityKey === selectedCity) ?? null;

  if (snapshot.status === 'loading') {
    return (
      <Screen name="map">
        <LoadingState note="正在加载离线地图数据…" />
      </Screen>
    );
  }

  const loadDemo = () => {
    void run(async () => { await service.loadDemo(); }, { success: '示例档案已加载' });
  };

  return (
    <Screen name="map">
      <PageHead
        crumb={<><a href="#/home">首页</a><span className="sep">/</span><span>我的地图</span></>}
        title="我的地图"
        lede="地图是档案的结果页，不是入口。城市按国家聚合，照片数按 Visit 归属统计；同一趟旅程里同一城市只计一次。"
        actions={
          <>
            <div className="segmented" role="group" aria-label="地图视图">
              <button type="button" aria-pressed={view === 'map'} onClick={() => setView('map')}><Icon name="map" className="icon icon-sm" />地图</button>
              <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}><Icon name="list" className="icon icon-sm" />列表</button>
            </div>
            <span className="tag"><Icon name="info" className="icon icon-xs" />城市级位置</span>
          </>
        }
      />

      {footprint.cities.length === 0 ? (
        <EmptyState
          icon="map"
          title="地图还是空的"
          body="还没有已确认的旅程。导入照片并确认候选后，城市会在地图上点亮；地图不承担唯一信息通道，城市也会以列表呈现。"
          actions={<><a className="btn btn-primary btn-lg" href="#/import">导入照片</a><button className="btn btn-secondary btn-lg" type="button" disabled={busy} onClick={loadDemo}>加载示例档案</button></>}
          meta="没有旅程时不会显示虚构的城市"
        />
      ) : (
        <>
          <div className="stat-row mb-4">
            <div className="stat"><span className="stat-label">点亮城市</span><span className="stat-value">{footprint.cityCount}<small>座</small></span><span className="stat-note">按 CityKey 去重</span></div>
            <div className="stat"><span className="stat-label">国家</span><span className="stat-value">{footprint.countryCount}<small>个</small></span><span className="stat-note">按 countryCode 去重</span></div>
            <div className="stat"><span className="stat-label">旅程</span><span className="stat-value">{footprint.tripCount}<small>趟</small></span><span className="stat-note">仅已确认 Trip</span></div>
            <div className="stat"><span className="stat-label">照片</span><span className="stat-value">{footprint.photoCount}<small>张</small></span><span className="stat-note">按 Photo ID 去重</span></div>
          </div>

          <div className="map-page-grid">
            {view === 'map' ? (
              <section className="card map-main" aria-label="世界足迹地图">
                <WorldMap
                  cities={footprint.cities}
                  visitedCountries={visitedCountries}
                  {...(selectedCity ? { selectedCityKeys: new Set([selectedCity]) } : {})}
                  onSelectCity={(key) => setSelectedCity(key === selectedCity ? null : key)}
                  ariaLabel={`世界地图，点亮 ${footprint.cityCount} 座城市，来自 ${footprint.countryCount} 个国家`}
                />
                <div className="map-topbar">
                  <button className={`chip${year === null ? ' is-active' : ''}`} type="button" onClick={() => { setYear(null); setSelectedCity(null); }}>
                    全部 <span className="count">{footprintOf(snapshot, null).cityCount}</span>
                  </button>
                  {years.map((item) => (
                    <button key={item} className={`chip${year === item ? ' is-active' : ''}`} type="button" onClick={() => { setYear(item); setSelectedCity(null); }}>
                      {item} <span className="count">{yearCounts.get(item) ?? 0}</span>
                    </button>
                  ))}
                </div>
                <div className="map-statbox">
                  <div className="eyebrow">{selected ? '已选城市' : '足迹总览'}</div>
                  <b>{selected ? `${selected.name} · ${selected.countryName}` : <>{footprint.cityCount} 城 <small>/ {footprint.countryCount} 国</small></>}</b>
                  <div className="sub">
                    {selected
                      ? `${selected.photoCount} 张照片 · ${selected.tripCount} 趟旅程 · 最近 ${selected.year}`
                      : year === null
                        ? `最近更新 · ${years[0] ?? '暂无年份'}`
                        : `${year} 年 · ${footprint.tripCount} 趟旅程`}
                  </div>
                </div>
                <div className="map-overlay map-legend">
                  <span><i className="legend-dot" />已点亮城市</span>
                  <span><i className="legend-ring" />选中城市</span>
                  <span><i className="legend-line" />Trip 路线</span>
                </div>
                <div className="map-overlay map-scale">1000 × 640 · 等距圆柱投影</div>
              </section>
            ) : null}

            <aside className="card map-side" aria-label="国家与城市列表">
              <div className="map-side-head">
                <h2>年份 <span className="pill-count">{years.length > 0 ? `${years[years.length - 1]}—${years[0]}` : '暂无'}</span></h2>
                <div className="sub">切换年份后，城市数、国家数、列表与地图着色同步变化</div>
              </div>
              <div className="year-row">
                <button className={`chip${year === null ? ' is-active' : ''}`} type="button" onClick={() => { setYear(null); setSelectedCity(null); }}>全部</button>
                {years.map((item) => (
                  <button key={item} className={`chip${year === item ? ' is-active' : ''}`} type="button" onClick={() => { setYear(item); setSelectedCity(null); }}>{item}</button>
                ))}
              </div>
              <div className="map-side-head" style={{ borderTop: 0 }}>
                <h2>按国家 <span className="pill-count">{countries.length}</span></h2>
                <span className="sub">城市数按 Trip 去重</span>
              </div>
              <div className="country-list">
                {countries.map((country) => (
                  <button
                    key={country.code}
                    className="country-row"
                    type="button"
                    onClick={() => setSelectedCity(country.cities[0]?.cityKey ?? null)}
                    style={{ width: '100%', textAlign: 'left', background: 'none', border: 0, cursor: 'pointer' }}
                  >
                    <div className="country-flag">{country.code}</div>
                    <div>
                      <div className="country-name"><span>{country.name}</span></div>
                      <div className="country-sub">{country.cities.length} 城 · {country.cities.map((city) => city.name).join(' / ')}</div>
                    </div>
                    <span className="mono" style={{ fontSize: 10 }}>{country.latestYear}</span>
                  </button>
                ))}
                {countries.length === 0 ? <p className="muted" style={{ padding: 14, fontSize: 12 }}>这一年还没有旅程，地图保留底图。</p> : null}
              </div>
              <div className="map-side-foot">
                <span>{footprint.cityCount} 个城市 · {footprint.countryCount} 个国家</span>
                <span>{footprint.tripCount} 趟 Trip</span>
              </div>
            </aside>

            <section className="card map-data-table" aria-label="地图数据表">
              <div className="card-head">
                <h2>城市数据表</h2>
                {view === 'list' ? <button className="btn btn-sm btn-secondary" type="button" onClick={() => setView('map')}>返回地图</button> : null}
              </div>
              <table>
                <thead><tr><th>城市</th><th>国家</th><th>最近年份</th><th className="num">照片</th><th className="num">旅程</th></tr></thead>
                <tbody>
                  {footprint.cities.map((city) => (
                    <tr key={city.cityKey} onClick={() => setSelectedCity(city.cityKey)} style={{ cursor: 'pointer' }}>
                      <td className="city">{city.name}</td>
                      <td>{city.countryName}</td>
                      <td className="yr">{city.year}</td>
                      <td className="num">{city.photoCount}</td>
                      <td className="num">{city.tripCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {footprint.cities.length === 0 ? <p className="muted" style={{ padding: 14, fontSize: 12 }}>这一年没有城市数据。</p> : null}
            </section>
          </div>
        </>
      )}
    </Screen>
  );
}

function groupCountries(cities: readonly CityStat[]): { code: string; name: string; latestYear: number; cities: CityStat[] }[] {
  const groups = new Map<string, { code: string; name: string; latestYear: number; cities: CityStat[] }>();
  for (const city of cities) {
    const group = groups.get(city.countryCode) ?? { code: city.countryCode, name: city.countryName, latestYear: city.year, cities: [] };
    group.latestYear = Math.max(group.latestYear, city.year);
    group.cities.push(city);
    groups.set(city.countryCode, group);
  }
  return Array.from(groups.values()).sort((a, b) => b.latestYear - a.latestYear || a.name.localeCompare(b.name, 'zh-CN'));
}
