export function TopBar({
  onImport,
  onDrawer,
  onSearch,
  onTheme,
  onSettings,
}: {
  readonly onImport: () => void;
  readonly onDrawer: () => void;
  readonly onSearch: () => void;
  readonly onTheme: () => void;
  readonly onSettings: () => void;
}) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          <span className="frog-sprite pose-front" />
        </span>
        <span className="brand-text">
          <strong>旅行青蛙</strong>
          <em>TRAVEL FROG · 地图墙</em>
        </span>
      </div>
      <nav className="actions" aria-label="主操作">
        <button className="tbtn primary" type="button" onClick={onImport}>
          <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M10 14V4M6 8l4-4 4 4" />
            <path d="M3.5 13v2.5A1.5 1.5 0 0 0 5 17h10a1.5 1.5 0 0 0 1.5-1.5V13" />
          </svg>
          <span>导入照片</span>
        </button>
        <button className="tbtn" type="button" onClick={onDrawer}>
          <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <rect x="3" y="4" width="14" height="12" rx="1.6" />
            <path d="M3 8h14M8 8v8" />
          </svg>
          <span>整理</span>
        </button>
        <button className="tbtn" type="button" onClick={onSearch}>
          <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <circle cx="9" cy="9" r="5.2" />
            <path d="m13 13 4 4" />
          </svg>
          <span>搜索</span>
          <kbd>Ctrl K</kbd>
        </button>
        <button className="tbtn icon-only" type="button" aria-label="切换主题" title="切换主题" onClick={onTheme}>
          <svg className="i-sun" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <circle cx="10" cy="10" r="3.4" />
            <path d="M10 2v1.8M10 16.2V18M2 10h1.8M16.2 10H18M4.3 4.3l1.3 1.3M14.4 14.4l1.3 1.3M15.7 4.3l-1.3 1.3M5.6 14.4l-1.3 1.3" />
          </svg>
          <svg className="i-moon" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M16 12.4A6.6 6.6 0 0 1 7.6 4a6.8 6.8 0 1 0 8.4 8.4Z" />
          </svg>
        </button>
        <button className="tbtn icon-only" type="button" aria-label="设置与隐私" title="设置与隐私" onClick={onSettings}>
          <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="10" cy="10" r="2.6" />
            <path d="M10 2.6v2M10 15.4v2M2.6 10h2M15.4 10h2M4.8 4.8l1.4 1.4M13.8 13.8l1.4 1.4M15.2 4.8l-1.4 1.4M6.2 13.8l-1.4 1.4" />
          </svg>
        </button>
      </nav>
    </header>
  );
}

export function Crumb({
  level,
  countryName,
  cityName,
  onWorld,
  onCountry,
  onCity,
}: {
  readonly level: 'world' | 'country' | 'city' | 'region';
  readonly countryName: string;
  readonly cityName: string;
  readonly onWorld: () => void;
  readonly onCountry: () => void;
  readonly onCity: () => void;
}) {
  const current = level === 'world' ? 0 : level === 'country' ? 1 : 2;
  return (
    <div className="crumb" aria-label="缩放级别">
      <button type="button" className={current === 0 ? 'current' : ''} onClick={onWorld}>
        世界
      </button>
      <span className="sep">/</span>
      <button type="button" className={current === 1 ? 'current' : ''} onClick={onCountry}>
        {countryName}
      </button>
      <span className="sep">/</span>
      <button type="button" className={current === 2 ? 'current' : ''} onClick={onCity}>
        {cityName}
      </button>
    </div>
  );
}

export function ZoomControls({
  level,
  onZoomIn,
  onZoomOut,
}: {
  readonly level: 'world' | 'country' | 'city' | 'region';
  readonly onZoomIn: () => void;
  readonly onZoomOut: () => void;
}) {
  return (
    <div className="zoomctl" role="group" aria-label="缩放">
      <button type="button" aria-label="放大" onClick={onZoomIn}>
        +
      </button>
      <button type="button" aria-label="缩小" onClick={onZoomOut}>
        −
      </button>
      <span className="level">{level === 'world' ? 'L0' : level === 'country' ? 'L1' : 'L2'}</span>
    </div>
  );
}

export function Tray({ count, onOpen }: { readonly count: number; readonly onOpen: () => void }) {
  return (
    <button className="tray" type="button" onClick={onOpen}>
      <span className="tray-icon" aria-hidden="true">
        <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M10 17s6-5.2 6-9.2A6 6 0 0 0 4 7.8C4 11.8 10 17 10 17Z" />
          <path d="M7.4 8.4 10 11l2.6-2.6" />
        </svg>
      </span>
      <span>未定位照片</span>
      <b>{count}</b>
    </button>
  );
}

export function EmptyCard({ onImport, onDemo }: { readonly onImport: () => void; readonly onDemo: () => void }) {
  return (
    <section className="empty-card">
      <span className="tape tape-l" aria-hidden="true" />
      <span className="tape tape-r" aria-hidden="true" />
      <div className="empty-frog" aria-hidden="true">
        <span className="frog-sprite pose-welcome" />
      </div>
      <h1>从照片开始</h1>
      <p>把手机里的一叠旅行照片拖进来。照片只在本机解析，位置和一句话记忆都留在这面墙上。</p>
      <div className="empty-actions">
        <button className="btn primary" type="button" onClick={onImport}>
          导入照片
        </button>
        <button className="btn ghost" type="button" onClick={onDemo}>
          先看看示例
        </button>
      </div>
      <p className="empty-note">示例数据会单独标记，可一键移除。</p>
    </section>
  );
}

export function Toast({ message }: { readonly message: string | null }) {
  if (!message) return null;
  return <div className="toast">{message}</div>;
}
