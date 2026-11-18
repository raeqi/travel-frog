import { useEffect, useMemo, useState } from 'react';
import type { Trip } from '../domain/trip/trip';
import { useArchive } from './context';
import { fmtLocalDate } from './format';
import { Icon, Sprite } from './icons';
import { navigate, useRoute, type Route } from './router';
import { captureOffsetOf, pendingCandidates, photosOfTrip, totalUnlocated } from './selectors';
import { Modal } from './ui';
import { FillScreen } from './screens/FillScreen';
import { FrogScreen } from './screens/FrogScreen';
import { GapsScreen } from './screens/GapsScreen';
import { HomeScreen } from './screens/HomeScreen';
import { ImportScreen } from './screens/ImportScreen';
import { MapScreen } from './screens/MapScreen';
import { ReplayScreen } from './screens/ReplayScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { TripDetailScreen } from './screens/TripDetailScreen';

const SCREEN_TITLES: Record<Route['screen'], string> = {
  home: '首页',
  import: '导入确认',
  trip: '行程详情',
  replay: '回放',
  map: '我的地图',
  fill: '照片补位置',
  frog: '青蛙',
  gaps: '缺口清单',
  settings: '设置与隐私',
};

const NAV_ITEMS: { key: string; label: string; icon: string; href: string; screens: Route['screen'][] }[] = [
  { key: 'home', label: '首页', icon: 'home', href: '#/home', screens: ['home'] },
  { key: 'trips', label: '旅程档案', icon: 'trips', href: '#/trip', screens: ['trip', 'replay'] },
  { key: 'map', label: '我的地图', icon: 'map', href: '#/map', screens: ['map'] },
  { key: 'import', label: '导入照片', icon: 'import', href: '#/import', screens: ['import'] },
  { key: 'fill', label: '照片补位置', icon: 'pin', href: '#/fill', screens: ['fill'] },
  { key: 'gaps', label: '缺口清单', icon: 'gap', href: '#/gaps', screens: ['gaps'] },
  { key: 'frog', label: '青蛙', icon: 'frog', href: '#/frog', screens: ['frog'] },
  { key: 'settings', label: '设置与隐私', icon: 'settings', href: '#/settings', screens: ['settings'] },
];

const NAV_GROUPS: { label: string; keys: string[] }[] = [
  { label: '档案', keys: ['home', 'trips', 'map'] },
  { label: '整理', keys: ['import', 'fill', 'gaps'] },
  { label: '继续', keys: ['frog', 'settings'] },
];

function formatBytes(value: number): string {
  if (value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size >= 10 || unit === 0 ? Math.round(size) : size.toFixed(1)} ${units[unit]}`;
}

function ActiveScreen({ route }: { route: Route }) {
  switch (route.screen) {
    case 'import':
      return <ImportScreen />;
    case 'trip':
      return <TripDetailScreen />;
    case 'replay':
      return <ReplayScreen />;
    case 'map':
      return <MapScreen />;
    case 'fill':
      return <FillScreen />;
    case 'frog':
      return <FrogScreen />;
    case 'gaps':
      return <GapsScreen />;
    case 'settings':
      return <SettingsScreen />;
    case 'home':
    default:
      return <HomeScreen />;
  }
}

interface SearchResult {
  key: string;
  title: string;
  meta: string;
  to: string;
}

function tripMatches(trip: Trip, query: string): boolean {
  const cities = trip.cityRefs.map((city) => city.name).join(' ');
  return `${trip.title} ${cities}`.toLocaleLowerCase('zh-CN').includes(query);
}

export function AppShell() {
  const snapshot = useArchive();
  const route = useRoute();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);

  const pending = pendingCandidates(snapshot).length;
  const unlocated = totalUnlocated(snapshot);
  const openWishes = snapshot.wishes.filter((wish) => wish.status !== 'visited').length;

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      root.dataset.theme = snapshot.settings.theme === 'system' ? (media.matches ? 'dark' : 'light') : snapshot.settings.theme;
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [snapshot.settings.theme]);

  useEffect(() => {
    document.documentElement.dataset.motion = snapshot.settings.reducedMotion === 'reduce' ? 'reduce' : 'system';
  }, [snapshot.settings.reducedMotion]);

  useEffect(() => {
    let active = true;
    const estimate = navigator.storage?.estimate?.();
    if (estimate) {
      void estimate.then((result) => {
        if (active) setStorage({ usage: result.usage ?? 0, quota: result.quota ?? 0 });
      });
    }
    return () => {
      active = false;
    };
  }, [snapshot.revision]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    document.title = `${SCREEN_TITLES[route.screen]} · travel-frog`;
  }, [route.screen]);

  useEffect(() => {
    const main = document.getElementById('main');
    if (main) main.scrollTop = 0;
  }, [route.screen, route.tripId]);

  const results = useMemo(() => {
    const target = query.trim().toLocaleLowerCase('zh-CN');
    if (target.length === 0) return [];
    const found: SearchResult[] = [];
    for (const trip of snapshot.trips) {
      if (tripMatches(trip, target)) {
        found.push({
          key: `trip-${trip.id}`,
          title: trip.title,
          meta: `${fmtLocalDate(trip.timeRange.start, captureOffsetOf(photosOfTrip(snapshot, trip.id)))} · ${trip.cityRefs.map((city) => city.name).slice(0, 2).join(' / ') || '未识别地点'}`,
          to: `trip/${trip.id}`,
        });
      }
    }
    for (const memory of snapshot.memories) {
      if (memory.text.toLocaleLowerCase('zh-CN').includes(target)) {
        const trip = snapshot.trips.find((item) => item.id === memory.tripId);
        found.push({
          key: `memory-${memory.id}`,
          title: memory.text,
          meta: trip ? `记忆 · ${trip.title}` : '记忆',
          to: `trip/${memory.tripId}`,
        });
      }
    }
    for (const wish of snapshot.wishes) {
      const haystack = `${wish.cityRef.name} ${wish.region ?? ''} ${wish.notes ?? ''}`.toLocaleLowerCase('zh-CN');
      if (haystack.includes(target)) {
        found.push({
          key: `wish-${wish.id}`,
          title: wish.cityRef.name,
          meta: `愿望 · ${wish.region ?? wish.cityRef.countryName}`,
          to: 'gaps',
        });
      }
    }
    return found.slice(0, 8);
  }, [query, snapshot]);

  const go = (to: string) => {
    setSearchOpen(false);
    setQuery('');
    navigate(to);
  };

  const share = storage && storage.quota > 0 ? Math.min(100, (storage.usage / storage.quota) * 100) : 0;

  return (
    <>
      <Sprite />
      <a className="skip-link" href="#main">
        跳到主要内容
      </a>
      <div className="app">
        <header className="topbar">
          <a className="brand" href="#/home" aria-label="travel-frog 首页">
            <span className="brand-mark">
              <svg className="frog-mark" viewBox="0 0 120 96" aria-hidden="true">
                <use href="#i-frog" />
              </svg>
            </span>
            <span className="brand-text">
              <b>travel-frog</b>
              <span>旅行档案 · LOCAL</span>
            </span>
          </a>
          <div className="topbar-context">
            <span>档案</span>
            <span className="sep">/</span>
            <strong>{SCREEN_TITLES[route.screen]}</strong>
          </div>
          <div className="topbar-spacer" />
          <button className="search-trigger" type="button" aria-label="搜索旅程、城市或记忆" onClick={() => setSearchOpen(true)}>
            <Icon name="search" className="icon icon-sm" />
            <span>搜索旅程、城市、记忆</span>
            <kbd>⌘K</kbd>
          </button>
          <span className="local-chip">
            <span className="dot-live" />
            仅本机 · 不联网
          </span>
          <a className="btn btn-primary btn-sm" href="#/import">
            <Icon name="import" />
            导入照片
          </a>
        </header>

        <div className="shell">
          <aside className="sidebar">
            <nav aria-label="主导航">
              {NAV_GROUPS.map((group) => (
                <div className="nav-group" key={group.label}>
                  <div className="nav-label">{group.label}</div>
                  {group.keys.map((key) => {
                    const item = NAV_ITEMS.find((entry) => entry.key === key);
                    if (!item) return null;
                    const active = item.screens.includes(route.screen);
                    const badge =
                      item.key === 'trips'
                        ? snapshot.trips.length
                        : item.key === 'import'
                          ? pending
                          : item.key === 'fill'
                            ? unlocated
                            : item.key === 'gaps'
                              ? openWishes
                              : null;
                    const tone = (item.key === 'import' || item.key === 'fill') && badge ? ' is-pending' : '';
                    return (
                      <a
                        key={item.key}
                        className={`nav-item${active ? ' is-active' : ''}`}
                        href={item.href}
                        data-nav={item.key}
                        aria-current={active ? 'page' : undefined}
                      >
                        <Icon name={item.icon} />
                        <span>{item.label}</span>
                        {badge !== null && badge > 0 ? <span className={`nav-badge${tone}`}>{badge}</span> : null}
                      </a>
                    );
                  })}
                </div>
              ))}
            </nav>
            <div className="sidebar-foot">
              <div className="storage-title">
                <span>本地存储</span>
                <span className="mono">{storage ? `${formatBytes(storage.usage)} / ${formatBytes(storage.quota)}` : '仅本机'}</span>
              </div>
              <div className="storage-bar" role="img" aria-label={`本地存储已使用 ${Math.round(share)}%`}>
                <i style={{ width: `${share}%` }} />
              </div>
              <div className="storage-meta">
                <span>{snapshot.photos.length} 张照片索引</span>
                <span>{Math.round(share)}%</span>
              </div>
              <div className="privacy-line">
                <Icon name="lock" className="icon icon-xs" />
                原图不上传 · 可随时导出或删除
              </div>
            </div>
          </aside>

          <main className="main" id="main" tabIndex={-1}>
            <ActiveScreen route={route} />
          </main>
        </div>
      </div>

      <Modal
        open={searchOpen}
        onClose={() => {
          setSearchOpen(false);
          setQuery('');
        }}
        title="搜索档案"
        sub="只在本机索引中查找，不发起网络请求"
        icon="search"
        wide
      >
        <div className="search-field">
          <Icon name="search" />
          <input
            className="input"
            type="search"
            autoFocus
            placeholder="输入旅程标题、城市或记忆内容"
            aria-label="搜索旅程、城市或记忆"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div style={{ marginTop: 14 }}>
          {query.trim().length === 0 ? (
            <p className="help">例如「京都」「海边」「第一次一个人旅行」。</p>
          ) : results.length === 0 ? (
            <p className="help">没有匹配的旅程、城市或记忆。</p>
          ) : (
            <ul className="search-results">
              {results.map((result) => (
                <li key={result.key}>
                  <button className="search-result" type="button" onClick={() => go(result.to)}>
                    <span className="result-title">{result.title}</span>
                    <span className="result-meta">{result.meta}</span>
                    <Icon name="arrow-right" className="icon icon-sm" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>
    </>
  );
}
