import { navigate, routePath, type Route } from '../lib/router';
import { useStore } from '../state';

const TABS: { name: Route['name']; label: string; num: string }[] = [
  { name: 'home', label: '我的地图', num: '01' },
  { name: 'import', label: '导入确认', num: '02' },
  { name: 'trip', label: '行程详情', num: '03' },
  { name: 'replay', label: '回放', num: '04' },
  { name: 'map', label: '地图全屏', num: '05' },
  { name: 'fill', label: '照片补位置', num: '06' },
  { name: 'frog', label: '青蛙', num: '07' },
  { name: 'gaps', label: '缺口清单', num: '08' },
  { name: 'settings', label: '设置与隐私', num: '09' },
];

interface Props {
  route: Route;
  activeTripId?: string;
}

export function TopBar({ route, activeTripId }: Props) {
  const { data } = useStore();
  const current = route.name;

  return (
    <header className="topbar">
      <div className="topbar-main">
        <div className="brand">
          <svg className="brand-mark" viewBox="0 0 140 110" aria-hidden="true">
            <ellipse cx="70" cy="72" rx="38" ry="26" fill="#fff" stroke="currentColor" strokeWidth="4" />
            <circle cx="48" cy="38" r="15" fill="#fff" stroke="currentColor" strokeWidth="4" />
            <circle cx="92" cy="38" r="15" fill="#fff" stroke="currentColor" strokeWidth="4" />
            <circle cx="48" cy="40" r="4.5" fill="currentColor" />
            <circle cx="92" cy="40" r="4.5" fill="currentColor" />
            <path d="M52 72 Q70 86 88 72" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          </svg>
          <b>travel-frog</b>
          <span className="brand-sub">我的旅行档案 · 有只青蛙替我守着</span>
        </div>
        <div className="topmeta">
          <span><i className="state-dot" /> 本地模式 · 不联网</span>
          <span className="sep" />
          <span>{data.trips.length} 趟 · {new Set(data.trips.flatMap((t) => t.cityNames)).size} 城</span>
          <button className="btn btn-sm" type="button" onClick={() => navigate(routePath('import'))}>导入照片</button>
        </div>
      </div>
      <nav className="tabs" aria-label="页面切换">
        {TABS.map((tab) => {
          const isActive = current === tab.name;
          return (
            <button
              key={tab.name}
              className={`tab ${isActive ? 'is-active' : ''}`}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => navigate(routePath(tab.name, tab.name === 'trip' || tab.name === 'replay' || tab.name === 'fill' ? activeTripId : undefined))}
            >
              <span className="tab-num">{tab.num}</span>
              {tab.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
