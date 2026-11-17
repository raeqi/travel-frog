import { useMemo } from 'react';
import { useStore } from '../state';
import { navigate, routePath } from '../lib/router';
import { fmtMonthDay, fmtRange, spanDays } from '../lib/format';
import { coverOfTrip, latestTrip, photosOfTrip, tripLabel } from '../lib/selectors';
import { PhotoThumb } from '../components/PhotoThumb';
import { FrogIcon } from '../components/FrogIcon';
import { WorldMap, citiesFromTrips } from '../components/WorldMap';

export function HomePage() {
  const { data, loadDemo } = useStore();
  const trips = useMemo(() => data.trips.slice().sort((a, b) => b.endAt - a.endAt), [data.trips]);
  const cities = useMemo(() => citiesFromTrips(trips, data.photos), [trips, data.photos]);
  const habitat = latestTrip(data);
  const countries = new Set(cities.map((c) => c.code).filter(Boolean)).size;
  const allPhotos = Object.keys(data.photos).length;

  return (
    <section className="screen is-active" id="screen-home">
      <div className="home-grid">
        <aside className="panel trips-panel">
          <div className="panel-head">
            <div>
              <div className="title-line"><span className="priority p0">P0</span><h2>旅程</h2></div>
              <p className="hint">按时间倒序 · {trips.length} 趟 · 共 {cities.length} 个城市</p>
            </div>
            <button className="link-btn" type="button" onClick={() => navigate(routePath('settings'))}>隐私设置</button>
          </div>
          <div className="trip-list">
            {trips.map((trip) => {
              const photos = photosOfTrip(data, trip.id);
              return (
                <button
                  key={trip.id}
                  className={`trip-item ${trip.id === habitat?.id ? 'is-active' : ''}`}
                  type="button"
                  onClick={() => navigate(routePath('trip', trip.id))}
                >
                  <PhotoThumb
                    className="trip-cover photo"
                    thumb={coverOfTrip(data, trip.id)}
                    label="封面"
                    caption={trip.cityNames[0] ?? '旅程'}
                  />
                  <span className="trip-main">
                    <span className="trip-date">{fmtRange(trip.startAt, trip.endAt)}</span>
                    <span className="trip-cities">{trip.cityNames.join(' / ')}</span>
                    <span className="trip-meta">
                      {photos.length} 张照片 · {trip.visits.length} 站 · {trip.cityNames.length} 城
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {!trips.length && (
            <div className="empty-trips" style={{ display: 'flex' }}>
              <span className="empty-mark" style={{ width: 46, height: 46, border: '1px dashed #b5b5b5', display: 'grid', placeItems: 'center', color: '#9a9a9a', fontSize: 18 }}>0</span>
              <strong>还没有旅程</strong>
              <p>导入一组照片，自动切出第一趟旅行。</p>
              <button className="btn btn-sm" type="button" onClick={() => navigate(routePath('import'))}>导入照片</button>
              <button className="link-btn" type="button" onClick={loadDemo}>或加载示例档案</button>
            </div>
          )}
          <div className="panel-foot">
            <button className="btn" type="button" onClick={() => navigate(routePath('import'))}>＋ 导入新照片</button>
          </div>
        </aside>

        <section className="panel map-panel" aria-label="我的地图">
          <div className="map-head">
            <h2>我的地图</h2>
            <span className="map-head-note">
              {cities.length} 个点亮城市 / {countries} 个国家{cities.length ? ` · 最近更新 ${cities[0].year}` : ''}
            </span>
          </div>
          <div className="map-canvas">
            {trips.length ? (
              <>
                <WorldMap
                  cities={cities}
                  trips={trips}
                  showRoutes
                  showLabels
                  onSelect={() => navigate(routePath('map'))}
                />
                <div className="map-note">离线世界底图 · 城市级位置</div>
                <div className="map-stat">
                  <span className="stat-cap">已点亮</span>
                  <strong>{cities.length} 城 <i>/</i> {countries} 国</strong>
                  <span className="stat-sub">
                    最近一次 · {trips[0] ? `${fmtMonthDay(trips[0].endAt)} ${trips[0].cityNames[0] ?? ''}` : '—'}
                  </span>
                </div>
                <div className="map-legend">
                  <span><i className="legend-dot" />已点亮城市</span>
                  <span><i className="legend-ring" />最近结束的 Trip</span>
                  <span><i className="legend-line" />Trip 路线</span>
                </div>
              </>
            ) : (
              <div className="empty-map" style={{ display: 'flex' }}>
                <div className="empty-mark">＋</div>
                <h2>还没有旅程</h2>
                <p>导入一次旅行的照片，自动切出行程后，地图会亮起来。</p>
                <button className="btn btn-primary" type="button" onClick={() => navigate(routePath('import'))}>导入照片</button>
              </div>
            )}
          </div>
        </section>

        <aside className="frog-panel" aria-label="青蛙卡片">
          <div className="frog-card">
            {habitat ? (
              <div className="frog-main">
                <div className="frog-kicker">
                  <span className="chip">最近结束的 Trip</span>
                  <span className="hint mono">{fmtMonthDay(habitat.endAt)} 回到{habitat.cityNames[0]}</span>
                </div>
                <h2 className="frog-title">我最近在 <b>{habitat.cityNames[0] ?? '路上'}</b></h2>
                <div className="frog-figure">
                  <FrogIcon className="frog-svg" />
                  <span className="fig-note">青蛙 · 位置锚</span>
                </div>
                <div className="frog-trip">
                  <span className="ft-title">{habitat.title}</span>
                  <span className="ft-meta">
                    {fmtRange(habitat.startAt, habitat.endAt)} · {habitat.cityNames.length} 城 · {habitat.visits.length} 站 · {photosOfTrip(data, habitat.id).length} 张
                  </span>
                </div>
                <blockquote className="home-memory">
                  {habitat.memory ? `“${habitat.memory}”` : '还没有写下一句话记忆。'}
                </blockquote>
                <div className="frog-actions">
                  <button className="btn btn-primary" type="button" onClick={() => navigate(routePath('replay', habitat.id))}>回放这趟</button>
                  <button className="btn" type="button" onClick={() => navigate(routePath('trip', habitat.id))}>打开行程详情</button>
                </div>
                <p className="frog-note">青蛙停在最近结束的 Trip · 从第 1 站开始重走</p>
                <p className="frog-note">已收录 {allPhotos} 张照片 · 全部在本地</p>
              </div>
            ) : (
              <div className="frog-empty" style={{ display: 'flex' }}>
                <FrogIcon className="frog-svg" mood="sleepy" />
                <h3>我还没有落脚的地方</h3>
                <p>导入一次旅行的照片，我就会住进最近结束的那趟。</p>
                <button className="btn btn-primary btn-sm" type="button" onClick={() => navigate(routePath('import'))}>导入照片</button>
              </div>
            )}
          </div>
          <div className="home-aside-note">
            <h3>旅程是怎么长出来的</h3>
            <ol>
              <li>读取照片的 EXIF 时间与 GPS，全程不出设备</li>
              <li>按时间相邻、地理接近、连续天数切分</li>
              <li>你确认 / 合并 / 拆分后，生成 Trip</li>
            </ol>
          </div>
          {trips.length > 0 && (
            <div className="home-aside-note">
              <h3>最近一趟的缺口</h3>
              <p className="hint">
                {(() => {
                  const missing = Object.values(data.photos).filter((p) => p.tripId === trips[0].id && (p.lat == null || p.lng == null) && !p.ignored).length;
                  return missing ? `${missing} 张照片没有位置，补齐后回放更完整。` : '这趟照片的位置都齐了。';
                })()}
              </p>
              <button className="link-btn" type="button" onClick={() => navigate(routePath('fill', trips[0].id))}>去补位置 →</button>
            </div>
          )}
          {trips[0] && (
            <div className="home-aside-note">
              <h3>{tripLabel(trips[0])}</h3>
              <p className="hint">{spanDays(trips[0].startAt, trips[0].endAt)} 天 · {trips[0].visits.length} 站</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
