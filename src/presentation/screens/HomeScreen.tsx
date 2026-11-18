import { useMemo, useState } from 'react';
import type { Trip } from '../../domain/trip/trip';
import { useArchive, useService } from '../context';
import { cityLabel, countryLabel, daysOf, fmtLocalDate, fmtLocalRange, placeholderFor } from '../format';
import { Icon } from '../icons';
import { tripHref } from '../router';
import { captureOffsetOf, footprintOf, memoryOf, pendingCandidates, photosOfTrip, totalUnlocated, tripOffsets, tripYears, tripsWithoutMemory, visitsOfTrip } from '../selectors';
import { Badge, EmptyState, ErrorState, LoadingState, PhotoThumb, PageHead, Screen, useAction } from '../ui';

export function HomeScreen() {
  const snapshot = useArchive();
  const service = useService();
  const { busy, run } = useAction();
  const [year, setYear] = useState<number | null>(null);

  const years = useMemo(() => tripYears(snapshot), [snapshot]);
  const trips = useMemo(
    () => (year === null ? snapshot.trips : snapshot.trips.filter((trip) => new Date(trip.timeRange.end - 1).getUTCFullYear() === year)),
    [snapshot.trips, year],
  );
  const footprint = useMemo(() => footprintOf(snapshot, null), [snapshot]);
  const pending = pendingCandidates(snapshot);
  const unlocated = totalUnlocated(snapshot);
  const noMemory = tripsWithoutMemory(snapshot);
  const hero = snapshot.trips[0] ?? null;
  const offsets = useMemo(() => tripOffsets(snapshot), [snapshot]);
  const heroOffset = hero ? offsets.get(hero.id) ?? null : null;

  if (snapshot.status === 'loading') {
    return (
      <Screen name="home">
        <LoadingState note="正在读取本地档案索引…" />
      </Screen>
    );
  }

  if (snapshot.status === 'error') {
    return (
      <Screen name="home">
        <ErrorState
          icon="database"
          title="无法打开本地档案"
          body={`${snapshot.error?.message ?? '本地数据库不可用'}。你的原图没有受到影响，索引没有被删除。`}
          actions={
            <>
              <button className="btn btn-primary" type="button" onClick={() => void service.load()}>
                重试
              </button>
              <a className="btn btn-secondary" href="#/settings">
                检查存储
              </a>
            </>
          }
          meta={`${snapshot.error?.code ?? 'STORAGE_OPEN_FAILED'} · 未发起任何网络请求`}
        />
      </Screen>
    );
  }

  if (!hero) {
    return (
      <Screen name="home">
        <PageHead eyebrow="私人旅行档案 · 仅本机" title="我的旅行档案" lede="还没有旅程。导入一组照片，自动切出第一趟旅行。" />
        <EmptyState
          icon="folder"
          title="还没有旅程"
          body="导入照片后，会按拍摄时间、地理距离和连续天数自动分成候选旅程。原图不上传，解析只在本机完成。"
          actions={
            <>
              <a className="btn btn-primary btn-lg" href="#/import">
                <Icon name="import" />
                导入照片
              </a>
              <button className="btn btn-secondary btn-lg" type="button" disabled={busy} onClick={() => void run(() => service.loadDemo(), { success: '示例档案已加载', error: '加载示例失败' })}>
                加载示例档案
              </button>
            </>
          }
          meta="示例档案会标注「示例」，并与真实数据隔离"
        />
      </Screen>
    );
  }

  const heroVisits = visitsOfTrip(snapshot, hero.id);
  const heroPhotos = photosOfTrip(snapshot, hero.id);
  const heroMemory = memoryOf(snapshot, hero);
  const heroMissing = heroPhotos.filter((photo) => photo.geo === null).length;
  const lastVisit = heroVisits[heroVisits.length - 1];

  return (
    <Screen name="home">
      <PageHead
        eyebrow="私人旅行档案 · 仅本机"
        title="我的旅行档案"
        lede={`${snapshot.trips.length} 趟旅程 · ${footprint.cityCount} 座城市 · ${footprint.countryCount} 个国家 · ${snapshot.photos.length} 张照片。`}
        actions={
          <>
            <a className="btn btn-secondary" href="#/map">
              <Icon name="map" />
              我的地图
            </a>
            <a className="btn btn-primary" href="#/import">
              <Icon name="import" />
              导入照片
            </a>
          </>
        }
      />

      <section className="home-hero" aria-label="最近结束的旅程">
        <div className="hero-copy">
          <div className="hero-topline">
            <Badge tone="confirmed" dot>
              最近结束
            </Badge>
            <span className="tag">{fmtLocalRange(hero.timeRange, heroOffset)}</span>
            {hero.origin === 'demo' ? <span className="tag tag-amber">示例数据</span> : <span className="tag tag-green">已确认</span>}
          </div>
          <h1>{hero.title}</h1>
          <div className="hero-meta">
            <span>{countryLabel(hero.cityRefs)} · {cityLabel(hero.cityRefs, 3)}</span>
            <span className="sep">·</span>
            <span>{daysOf(hero.timeRange)} 天</span>
            <span className="sep">·</span>
            <span>{heroVisits.length} 个站点</span>
          </div>
          <div className="hero-stats">
            <div className="stat">
              <span className="stat-label">照片</span>
              <span className="stat-value">{heroPhotos.length}<small>张</small></span>
            </div>
            <div className="stat">
              <span className="stat-label">城市</span>
              <span className="stat-value">{hero.cityRefs.length}<small>座</small></span>
            </div>
            <div className="stat">
              <span className="stat-label">站点</span>
              <span className="stat-value">{heroVisits.length}<small>个</small></span>
            </div>
            <div className="stat">
              <span className="stat-label">缺定位</span>
              <span className={`stat-value${heroMissing > 0 ? ' text-pending' : ''}`}>{heroMissing}<small>张</small></span>
            </div>
          </div>
          {heroMemory ? (
            <blockquote className="hero-memory">
              <svg className="frog-mark" aria-hidden="true">
                <use href="#i-frog" />
              </svg>
              <span>“{heroMemory.text}”</span>
            </blockquote>
          ) : null}
          <div className="hero-actions">
            <a className="btn btn-primary" href={`#/replay/${encodeURIComponent(hero.id)}`}>
              <Icon name="play" />
              回放这趟
            </a>
            <a className="btn btn-secondary" href={tripHref(hero.id)}>
              打开旅程
              <Icon name="arrow-right" className="icon icon-sm" />
            </a>
            {heroMissing > 0 ? (
              <a className="btn btn-ghost" href={`#/fill/${encodeURIComponent(hero.id)}`}>
                <Icon name="pin" />
                补齐 {heroMissing} 张位置
              </a>
            ) : null}
          </div>
        </div>
        <div className="hero-visual" aria-label="旅程照片">
          <div className="hero-collage">
            {heroPhotos.slice(0, 3).map((photo) => (
              <PhotoThumb key={photo.id} photo={photo} />
            ))}
            {heroPhotos.length === 0 ? <div className={`ph ${placeholderFor(hero.id)}`}><span className="ph-art" /></div> : null}
          </div>
          <div className="hero-stamp">
            <b>青蛙停在{lastVisit?.cityRef.name ?? cityLabel(hero.cityRefs, 1)}</b>
            {fmtLocalDate(hero.timeRange.end - 1, heroOffset)} · 第 {heroVisits.length} 站
          </div>
        </div>
      </section>

      <div className="home-grid">
        <div>
          <div className="section-head">
            <div>
              <h2>旅程档案</h2>
              <div className="sub">按结束时间倒序 · 共 {trips.length} 趟</div>
            </div>
            <div className="section-head-actions">
              <button className={`chip${year === null ? ' is-active' : ''}`} type="button" onClick={() => setYear(null)}>
                全部
              </button>
              {years.map((item) => (
                <button key={item} className={`chip${year === item ? ' is-active' : ''}`} type="button" onClick={() => setYear(item)}>
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="trip-grid">
            {trips.map((trip) => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </div>
          {trips.length === 0 ? (
            <div className="empty empty-inline">
              <div className="empty-icon"><Icon name="trips" /></div>
              <h3>这一年还没有旅程</h3>
              <p>切换到「全部」查看其它年份，或导入新的照片。</p>
            </div>
          ) : null}
        </div>

        <aside className="home-rail" aria-label="青蛙、足迹与待处理">
          <div className="frog-card">
            <svg className="frog-watermark" aria-hidden="true"><use href="#i-frog" /></svg>
            <div className="frog-card-top">
              <Badge tone="confirmed" dot>最近回来</Badge>
              <span className="mini-label">FROG</span>
            </div>
            <svg className="frog-art" viewBox="0 0 120 96" style={{ width: 64, height: 52 }} aria-hidden="true">
              <use href="#i-frog" />
            </svg>
            <h3>青蛙停在{lastVisit?.cityRef.name ?? '最近的城市'}</h3>
            <p>
              {fmtLocalDate(hero.timeRange.end - 1, heroOffset)} 回到{lastVisit?.displayName ?? cityLabel(hero.cityRefs, 1)} · 第 {heroVisits.length} 站
            </p>
            {heroMemory ? <div className="quote">“{heroMemory.text}”</div> : null}
            <div className="hstack">
              <a className="btn btn-sm btn-primary" href={`#/replay/${encodeURIComponent(hero.id)}`}>回放最近一趟</a>
              <a className="btn btn-sm btn-ghost" href="#/frog">看它记得的</a>
            </div>
          </div>

          <div className="mini-map-card" aria-label="足迹缩略地图">
            <MiniMap />
            <div className="overlay">
              <div className="glass">
                <b>{footprint.cityCount} 城 · {footprint.countryCount} 国</b>
                <span>{years.length > 0 ? `${years[years.length - 1]}—${years[0]}` : '暂无年份'}</span>
              </div>
              <a className="glass link" href="#/map">看地图 →</a>
            </div>
          </div>

          <div className="card todo-card">
            <div className="card-head">
              <h3>等你处理</h3>
              <span className="pill-count">{pending.length + (unlocated > 0 ? 1 : 0) + (noMemory.length > 0 ? 1 : 0)}</span>
            </div>
            {pending.length > 0 ? (
              <a className="list-row" href="#/import">
                <span className="todo-icon is-pending"><Icon name="import" className="icon icon-sm" /></span>
                <span className="list-main">
                  <span className="list-title">{pending.length} 段候选待确认</span>
                  <span className="list-sub">{pending.reduce((sum, item) => sum + item.photoIds.length, 0)} 张照片</span>
                </span>
                <Icon name="chevron-right" className="icon icon-sm" />
              </a>
            ) : null}
            {unlocated > 0 ? (
              <a className="list-row" href="#/fill">
                <span className="todo-icon is-pending"><Icon name="pin" className="icon icon-sm" /></span>
                <span className="list-main">
                  <span className="list-title">{unlocated} 张照片缺位置</span>
                  <span className="list-sub">可按同日 GPS 补位置</span>
                </span>
                <Icon name="chevron-right" className="icon icon-sm" />
              </a>
            ) : null}
            {noMemory.length > 0 ? (
              <a className="list-row" href={tripHref(noMemory[0]?.id ?? hero.id)}>
                <span className="todo-icon is-danger"><Icon name="gap" className="icon icon-sm" /></span>
                <span className="list-main">
                  <span className="list-title">{noMemory.length} 趟旅程缺一句话记忆</span>
                  <span className="list-sub">{noMemory[0]?.title}</span>
                </span>
                <Icon name="chevron-right" className="icon icon-sm" />
              </a>
            ) : null}
            {pending.length + unlocated + noMemory.length === 0 ? (
              <div className="card-body">
                <p className="muted" style={{ fontSize: 12 }}>档案完整，没有待处理的缺口。</p>
              </div>
            ) : null}
          </div>

          <div className="home-footnote">
            <Icon name="lock" />
            <span>所有照片、坐标与记忆默认只存在这台设备的浏览器里。示例数据可一键清除。</span>
          </div>
        </aside>
      </div>
    </Screen>
  );
}

function TripCard({ trip }: { trip: Trip }) {
  const snapshot = useArchive();
  const photos = photosOfTrip(snapshot, trip.id);
  const visits = visitsOfTrip(snapshot, trip.id);
  const missing = photos.filter((photo) => photo.geo === null).length;
  const first = photos[0];
  const offset = captureOffsetOf(photos);
  return (
    <a className="trip-card" href={tripHref(trip.id)}>
      <div className={`trip-cover ph ${placeholderFor(trip.id)}`}>
        {first ? <PhotoThumb photo={first} className="ph-cover-img" /> : <span className="ph-art" />}
        <span className="year">{new Date(trip.timeRange.end - 1).getUTCFullYear()}</span>
        <span className="ph-label">{cityLabel(trip.cityRefs, 2)}</span>
      </div>
      <div className="trip-body">
        <span className="trip-date">{fmtLocalRange(trip.timeRange, offset)}</span>
        <span className="trip-title">{trip.title}</span>
        <span className="trip-cities">{cityLabel(trip.cityRefs, 3)} · {countryLabel(trip.cityRefs)}</span>
        <span className="trip-foot">
          <span>{photos.length} 张</span>
          <span className="sep">·</span>
          <span>{visits.length} 站</span>
          {trip.origin === 'demo' ? <span className="badge badge-neutral" style={{ marginLeft: 'auto' }}>示例</span> : null}
          {missing > 0 ? <span className="badge badge-pending" style={{ marginLeft: 'auto' }}>{missing} 缺定位</span> : null}
          {trip.memoryId ? <span className="badge badge-confirmed" style={{ marginLeft: 'auto' }}>记忆已写</span> : null}
        </span>
      </div>
    </a>
  );
}

function MiniMap() {
  return (
    <svg className="map-svg" viewBox="0 0 1000 640" role="img" aria-label="足迹缩略地图">
      <MiniMapInner />
    </svg>
  );
}

function MiniMapInner() {
  const snapshot = useArchive();
  const footprint = useMemo(() => footprintOf(snapshot, null), [snapshot]);
  return <WorldMapThin cities={footprint.cities} />;
}

function WorldMapThin({ cities }: { cities: readonly { centroid: { lat: number; lng: number } | null; cityKey: string }[] }) {
  return (
    <>
      {cities.map((city) => {
        if (!city.centroid) return null;
        const x = ((city.centroid.lng + 180) / 360) * 1000;
        const y = ((90 - city.centroid.lat) / 180) * 640;
        return <circle key={city.cityKey} className="map-city-marker" cx={x} cy={y} r={3} />;
      })}
    </>
  );
}
