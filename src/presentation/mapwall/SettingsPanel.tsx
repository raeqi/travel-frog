import { useState } from 'react';

export type ThemeChoice = 'light' | 'dark' | 'system';

export interface SettingsPanelProps {
  readonly open: boolean;
  readonly theme: ThemeChoice;
  readonly hints: boolean;
  readonly tripCount: number;
  readonly photoCount: number;
  readonly wishCount: number;
  readonly lastWrite: string;
  readonly onClose: () => void;
  readonly onTheme: (theme: ThemeChoice) => void;
  readonly onHints: (enabled: boolean) => void;
  readonly onExport: () => void;
  readonly onDemo: () => void;
  readonly onRemoveDemo: () => void;
  readonly onClearAll: () => void;
}

export function SettingsPanel({
  open,
  theme,
  hints,
  tripCount,
  photoCount,
  wishCount,
  lastWrite,
  onClose,
  onTheme,
  onHints,
  onExport,
  onDemo,
  onRemoveDemo,
  onClearAll,
}: SettingsPanelProps) {
  const [confirmClear, setConfirmClear] = useState(false);
  if (!open) return null;

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <section className="settings" aria-label="设置与隐私">
        <header className="settings-head">
          <div>
            <h2>设置与隐私</h2>
            <p>档案保存在这台设备上，无账号与云同步。真实地点查询可按需联网。</p>
          </div>
          <button className="icon-btn" type="button" aria-label="关闭设置" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="settings-body">
          <section className="set-block">
            <h3>本地存储</h3>
            <dl className="kv">
              <div>
                <dt>照片与坐标</dt>
                <dd>仅本机 IndexedDB</dd>
              </div>
              <div>
                <dt>云同步</dt>
                <dd className="muted">未提供</dd>
              </div>
              <div>
                <dt>上次写入</dt>
                <dd>{lastWrite}</dd>
              </div>
              <div>
                <dt>档案</dt>
                <dd>
                  {tripCount} 趟 · {photoCount} 张 · {wishCount} 张明信片
                </dd>
              </div>
            </dl>
            <div className="set-row">
              <button className="btn ghost" type="button" onClick={onExport}>
                导出档案 JSON
              </button>
              <span className="hint">导出文件包含精确坐标，请妥善保管。</span>
            </div>
          </section>

          <section className="set-block">
            <h3>真实地点查询</h3>
            <p className="set-copy">仅在地图的“真实地点”面板点击查询时联网。当前地图中心会舍入至约100米精度，与查询半径一起发送给用户选定的 Wikipedia（en.wikipedia.org）或 OpenStreetMap 查询服务（overpass.private.coffee）；相应服务也会接收IP。照片、旅行档案与设备定位不发送，地图拖动不会自动查询。</p>
            <a href="https://overpass.private.coffee/" target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">查询服务与隐私说明 ↗</a>
          </section>

          <section className="set-block">
            <h3>外观</h3>
            <div className="seg" role="group" aria-label="主题">
              <button className={theme === 'light' ? 'is-on' : ''} type="button" onClick={() => onTheme('light')}>
                浅色
              </button>
              <button className={theme === 'dark' ? 'is-on' : ''} type="button" onClick={() => onTheme('dark')}>
                深色
              </button>
              <button className={theme === 'system' ? 'is-on' : ''} type="button" onClick={() => onTheme('system')}>
                跟随系统
              </button>
            </div>
            <label className="check">
              <input type="checkbox" checked={hints} onChange={(event) => onHints(event.target.checked)} />
              <span>青蛙在整理提示时出现（可在这里关掉）</span>
            </label>
          </section>

          <section className="set-block">
            <h3>演示数据</h3>
            <p className="set-copy">示例档案带有「示例」标记，和真实照片分开存放，可以随时移除。</p>
            <div className="set-row">
              <button className="btn ghost" type="button" onClick={onDemo}>
                加载示例档案
              </button>
              <button className="btn ghost" type="button" onClick={onRemoveDemo}>
                移除示例
              </button>
            </div>
          </section>

          <section className="set-block danger-block">
            <h3>清空全部数据</h3>
            <p className="set-copy">删除所有旅行、照片记录、愿望与设置。不可恢复；你的原图不受影响。</p>
            <button className="btn danger" type="button" onClick={() => setConfirmClear(true)}>
              清空全部数据…
            </button>
            {confirmClear ? (
              <div className="confirm-box">
                <p>
                  <strong>确定清空？</strong> 这会删除这台设备上的全部档案，且不能撤销。
                </p>
                <div className="confirm-actions">
                  <button
                    className="btn danger"
                    type="button"
                    onClick={() => {
                      setConfirmClear(false);
                      onClearAll();
                    }}
                  >
                    确定清空
                  </button>
                  <button className="btn ghost" type="button" onClick={() => setConfirmClear(false)}>
                    取消
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </section>
    </>
  );
}
