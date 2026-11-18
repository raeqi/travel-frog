import { useEffect, useMemo, useState } from 'react';
import type { Settings, ThemePreference } from '../../domain/settings/settings';
import { useArchive, useService } from '../context';
import { Icon } from '../icons';
import { Badge, ErrorState, LoadingState, Modal, PageHead, Screen, useAction } from '../ui';

const THEMES: { value: ThemePreference; title: string; note: string; swatch: [string, string, string] }[] = [
  { value: 'light', title: '浅色', note: '明亮、纸质档案', swatch: ['#F7F8FA', '#FFFFFF', '#247843'] },
  { value: 'dark', title: '深色', note: '夜间、低光环境', swatch: ['#12161C', '#1C2129', '#86C99A'] },
  { value: 'system', title: '跟随系统', note: '随系统自动切换', swatch: ['#F7F8FA', '#1C2129', '#3B78DB'] },
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

export function SettingsScreen() {
  const snapshot = useArchive();
  const service = useService();
  const { busy, run } = useAction();
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const [includeCoordinates, setIncludeCoordinates] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState('');
  const [restoreOpen, setRestoreOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const estimate = navigator.storage?.estimate?.();
    if (estimate) {
      void estimate
        .then((result) => {
          if (!active) return;
          setStorage({ usage: result.usage ?? 0, quota: result.quota ?? 0 });
        })
        .catch(() => setStorage(null));
    }
    return () => {
      active = false;
    };
  }, [snapshot.revision]);

  const demoCount = useMemo(() => {
    const ids = new Set<string>();
    for (const trip of snapshot.trips) if (trip.origin === 'demo') ids.add(trip.id);
    for (const candidate of snapshot.candidates) if (candidate.origin === 'demo') ids.add(candidate.id);
    for (const wish of snapshot.wishes) if (wish.origin === 'demo') ids.add(wish.id);
    return ids.size;
  }, [snapshot]);

  if (snapshot.status === 'loading') {
    return (
      <Screen name="settings">
        <LoadingState note="正在读取本地存储估算…" />
      </Screen>
    );
  }

  if (snapshot.status === 'error') {
    return (
      <Screen name="settings">
        <PageHead crumb={<><a href="#/home">首页</a><span className="sep">/</span><span>设置与隐私</span></>} title="设置与隐私" />
        <ErrorState
          icon="database"
          title="IndexedDB 不可用"
          body={`${snapshot.error?.message ?? '浏览器拒绝了本地数据库访问'}。已有数据没有被删除；设置无法保存，直到存储恢复。`}
          actions={
            <>
              <button className="btn btn-primary btn-sm" type="button" onClick={() => void service.load()}>
                重试
              </button>
              <a className="btn btn-secondary btn-sm" href="#/home">
                返回首页
              </a>
            </>
          }
          meta="原图从未被复制进浏览器。"
        />
      </Screen>
    );
  }

  const settings = snapshot.settings;
  const update = (patch: Partial<Settings>) => {
    void run(() => service.saveSettings(patch), { error: '保存设置失败' });
  };

  const applyTheme = (theme: ThemePreference) => update({ theme });

  const exportJson = async () => {
    const archive = await service.exportArchive(includeCoordinates);
    const blob = new Blob([JSON.stringify(archive, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const stamp = new Date(archive.exportedAt).toISOString().slice(0, 10);
    anchor.href = url;
    anchor.download = `travel-frog-${stamp}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportArchive = () =>
    run(
      async () => {
        await exportJson();
      },
      {
        success: includeCoordinates ? '已导出 JSON 档案（含精确坐标）' : '已导出 JSON 档案（坐标已脱敏）',
        error: '导出失败',
      },
    );

  const deleteAll = async () => {
    const ok = await run(
      async () => {
        await service.deleteAll();
      },
      { success: '本地数据已删除，原图文件不受影响', error: '删除失败' },
    );
    if (ok) {
      setDeleteOpen(false);
      setDeletePhrase('');
    }
  };

  const usageShare = storage && storage.quota > 0 ? (storage.usage / storage.quota) * 100 : 0;

  return (
    <Screen name="settings">
      <PageHead
        crumb={<><a href="#/home">首页</a><span className="sep">/</span><span>设置与隐私</span></>}
        title="设置与隐私"
        lede="默认最小权限：原图不出设备、云同步关闭、只同步城市级位置。每一项都可以单独撤回；没有账号体系。"
        actions={
          <>
            <span className="tag tag-green"><Icon name="shield" />本地模式</span>
            <span className="tag">v2 · schema 2</span>
          </>
        }
      />

      <div className="settings-wrap">
        <div>
          <section className="card settings-group" aria-label="隐私设置">
            <div className="settings-group-head"><h2>隐私</h2><span>默认最小权限 · 每项可单独撤回</span></div>

            <div className="setting-row">
              <div className="setting-copy">
                <div className="setting-title">原图不出设备 <Badge tone="confirmed">默认开启</Badge></div>
                <div className="setting-desc">照片原图只在浏览器本地解析，上传、导出和回放都不请求原图。v2 没有上传路径；关闭只会记录偏好。</div>
              </div>
              <div className="setting-control">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={settings.rawPhotoLocal}
                    onChange={(event) => update({ rawPhotoLocal: event.target.checked })}
                  />
                  <span className="track" />
                  <span className="switch-label">{settings.rawPhotoLocal ? '开启' : '关闭'}</span>
                </label>
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-copy">
                <div className="setting-title">云同步 <Badge>默认关闭</Badge></div>
                <div className="setting-desc">v2 不发起任何同步请求。开启后只保存偏好；未来即使同步，也只允许城市、时间、计数与记忆。</div>
              </div>
              <div className="setting-control">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={settings.cloudSync}
                    onChange={(event) => update({ cloudSync: event.target.checked })}
                  />
                  <span className="track" />
                  <span className="switch-label">{settings.cloudSync ? '开启' : '关闭'}</span>
                </label>
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-copy">
                <div className="setting-title">只同步城市级位置 <Badge tone="confirmed">默认开启</Badge></div>
                <div className="setting-desc">即使开启同步，也只写入城市与站点级位置，不写入精确经纬度；地图落点由本地数据渲染。</div>
              </div>
              <div className="setting-control">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={settings.cityLevelOnly}
                    onChange={(event) => update({ cityLevelOnly: event.target.checked })}
                  />
                  <span className="track" />
                  <span className="switch-label">{settings.cityLevelOnly ? '开启' : '关闭'}</span>
                </label>
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-copy">
                <div className="setting-title">匿名诊断</div>
                <div className="setting-desc">v2 不采集，也没有开关可以打开。诊断日志只保留最近 500 条，不包含文件名、坐标与记忆文本。</div>
              </div>
              <div className="setting-control">
                <label className="switch">
                  <input type="checkbox" checked={false} disabled readOnly />
                  <span className="track" />
                  <span className="switch-label">未采集</span>
                </label>
              </div>
            </div>
          </section>

          <section className="card settings-group" aria-label="外观设置">
            <div className="settings-group-head"><h2>外观</h2><span>跟随系统或手动选择</span></div>
            <div className="theme-options" role="radiogroup" aria-label="主题">
              {THEMES.map((item) => (
                <button
                  key={item.value}
                  className={`theme-option${settings.theme === item.value ? ' is-active' : ''}`}
                  type="button"
                  role="radio"
                  aria-checked={settings.theme === item.value}
                  data-theme-choice={item.value}
                  onClick={() => applyTheme(item.value)}
                >
                  <span className="theme-swatch">
                    <i style={{ background: item.swatch[0] }} />
                    <i style={{ background: item.swatch[1] }} />
                    <i style={{ background: item.swatch[2] }} />
                  </span>
                  <b>{item.title}</b>
                  <span>{item.note}</span>
                </button>
              ))}
            </div>
            <div className="setting-row">
              <div className="setting-copy">
                <div className="setting-title">减少动效</div>
                <div className="setting-desc">关闭地图飞行、时间轴惯性与面板位移动画，只保留透明度瞬时切换。默认遵循系统设置。</div>
              </div>
              <div className="setting-control">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={settings.reducedMotion === 'reduce'}
                    onChange={(event) => update({ reducedMotion: event.target.checked ? 'reduce' : 'system' })}
                  />
                  <span className="track" />
                  <span className="switch-label">{settings.reducedMotion === 'reduce' ? '已减少' : '跟随系统'}</span>
                </label>
              </div>
            </div>
          </section>

          <section className="card settings-group" aria-label="数据设置">
            <div className="settings-group-head"><h2>数据</h2><span>都在本机生成</span></div>
            <div className="setting-row">
              <div className="setting-copy">
                <div className="setting-title">导出 JSON 档案</div>
                <div className="setting-desc">导出 Trip、Visit、Photo 元数据、记忆、愿望与设置，不包含原图与缩略图。默认对坐标脱敏。</div>
              </div>
              <div className="setting-control">
                <div className="setting-actions">
                  <label className="checkbox" style={{ fontSize: 10.5 }}>
                    <input
                      type="checkbox"
                      checked={includeCoordinates}
                      onChange={(event) => setIncludeCoordinates(event.target.checked)}
                    />
                    含精确坐标
                  </label>
                  <button className="btn btn-sm btn-secondary" type="button" disabled={busy} onClick={() => void exportArchive()}>
                    <Icon name="download" />导出 JSON
                  </button>
                </div>
              </div>
            </div>
            {includeCoordinates ? (
              <div className="edge-banner is-pending" style={{ display: 'flex', margin: '12px 16px' }}>
                <Icon name="alert" />
                <span><b>包含精确坐标：</b>导出的 JSON 会写入照片的原始经纬度。只在你确认接收方与保存位置安全时使用。</span>
              </div>
            ) : null}
            <div className="setting-row">
              <div className="setting-copy">
                <div className="setting-title text-danger">删除全部数据</div>
                <div className="setting-desc">清空本机 IndexedDB、缩略图与记忆，不可恢复。原图文件不受影响；删除前需要二次确认。</div>
              </div>
              <div className="setting-control">
                <button className="btn btn-sm btn-danger" type="button" disabled={busy} onClick={() => setDeleteOpen(true)}>
                  <Icon name="trash" />删除全部数据
                </button>
              </div>
            </div>
          </section>

          <section className="card settings-group" aria-label="示例数据">
            <div className="settings-group-head"><h2>示例数据</h2><span>只在显式操作下出现</span></div>
            <div className="setting-row">
              <div className="setting-copy">
                <div className="setting-title">示例档案 {demoCount > 0 ? <Badge tone="pending">已加载</Badge> : null}</div>
                <div className="setting-desc">
                  示例旅程、照片元数据与愿望都标记 origin=demo，与真实导入数据分离。可以一键移除，不会触碰你的照片与记忆。
                </div>
              </div>
              <div className="setting-control">
                <div className="setting-actions">
                  {demoCount > 0 ? (
                    <button
                      className="btn btn-sm btn-secondary"
                      type="button"
                      disabled={busy}
                      onClick={() => void run(() => service.removeDemo(), { success: '示例数据已移除', error: '移除示例失败' })}
                    >
                      移除示例
                    </button>
                  ) : (
                    <button
                      className="btn btn-sm btn-secondary"
                      type="button"
                      disabled={busy}
                      onClick={() => void run(() => service.loadDemo(), { success: '示例档案已加载', error: '加载示例失败' })}
                    >
                      加载示例档案
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="card settings-group" aria-label="关于">
            <div className="settings-group-head"><h2>关于</h2><span>无需登录</span></div>
            <div className="setting-row">
              <div className="setting-copy">
                <div className="setting-title">travel-frog · 本地档案</div>
                <div className="setting-desc">单用户、本地优先。没有账号体系，不收集邮箱与设备标识；换设备时通过导出的 JSON 手动迁移。</div>
              </div>
              <div className="setting-control">
                <span className="tag">未登录</span>
              </div>
            </div>
            <div className="about-list" style={{ padding: '8px 16px 12px' }}>
              <div className="row"><span>数据结构版本</span><span>schema 2</span></div>
              <div className="row"><span>本地照片</span><span>{snapshot.photos.length}</span></div>
              <div className="row"><span>本地旅程</span><span>{snapshot.trips.length}</span></div>
              <div className="row"><span>站点</span><span>{snapshot.visits.length}</span></div>
              <div className="row"><span>记忆</span><span>{snapshot.memories.length}</span></div>
              <div className="row"><span>运行时外部请求</span><span>0</span></div>
            </div>
          </section>
        </div>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="promise-card">
            <h3><Icon name="shield" className="icon icon-sm" />三条承诺</h3>
            <ul>
              <li><Icon name="check" /><span>原图默认不出设备，v2 没有上传路径。</span></li>
              <li><Icon name="check" /><span>云同步默认关闭，开启只保存偏好。</span></li>
              <li><Icon name="check" /><span>精确坐标只在本机；导出会明确提示风险。</span></li>
            </ul>
          </div>

          <div className="card">
            <div className="card-head">
              <h3>存储</h3>
              <Badge tone={usageShare > 90 ? 'danger' : 'confirmed'}>{usageShare > 90 ? '告急' : '正常'}</Badge>
            </div>
            <div className="card-body">
              <div className="hstack" style={{ justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-secondary)' }}>
                <span>已使用</span>
                <span className="mono">{storage ? `${formatBytes(storage.usage)} / ${formatBytes(storage.quota)}` : '浏览器未提供'}</span>
              </div>
              <div className="progress mt-2">
                <i style={{ width: `${Math.min(100, Math.max(0, usageShare))}%` }} />
              </div>
              <div className="hstack mt-3" style={{ justifyContent: 'space-between', fontSize: 10, color: 'var(--color-text-tertiary)' }}>
                <span>{snapshot.photos.length} 张照片索引</span>
                <span>{storage ? `${Math.round(usageShare)}%` : '未知'}</span>
              </div>
              <div className="preview-note" style={{ marginTop: 12 }}>
                浏览器清理存储或隐私模式可能导致 IndexedDB 丢失。建议定期导出 JSON 备份；恢复后缩略图会重新生成或显示占位。
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3>本次会话</h3></div>
            <div className="about-list" style={{ padding: '6px 16px 10px' }}>
              <div className="row"><span>网络请求</span><span>0</span></div>
              <div className="row"><span>照片上传</span><span>0</span></div>
              <div className="row"><span>遥测事件</span><span>0</span></div>
              <div className="row"><span>数据目录</span><span>IndexedDB</span></div>
            </div>
            <div className="card-foot">
              <span className="hint" style={{ fontSize: 10 }}>断网仍可完成全部 P0 流程</span>
              <span className="dot-live" />
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3>恢复档案</h3></div>
            <div className="card-body">
              <div className="preview-note">读取同一版本的导出 JSON。恢复前会预览差异并要求二次确认；覆盖本地数据不可撤销。</div>
              <button className="btn btn-sm btn-secondary mt-3" type="button" onClick={() => setRestoreOpen(true)}>
                <Icon name="import" />选择文件
              </button>
            </div>
          </div>
        </aside>
      </div>

      <Modal
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setDeletePhrase('');
        }}
        title="删除全部本地数据？"
        sub="二次确认 · 不可撤销"
        icon="trash"
        tone="danger"
        footer={
          <>
            <button className="btn btn-secondary" type="button" onClick={() => setDeleteOpen(false)}>取消</button>
            <button className="btn btn-danger" type="button" disabled={deletePhrase.trim() !== '删除全部' || busy} onClick={() => void deleteAll()}>
              <Icon name="trash" />确认删除
            </button>
          </>
        }
      >
        <p style={{ fontSize: 13, lineHeight: 1.7 }}>
          将清空本机 IndexedDB 中的全部旅程、站点、照片索引、缩略图、记忆与愿望。原图文件不受影响，但档案记录不可恢复。
        </p>
        <div className="field mt-4">
          <label htmlFor="delete-confirm">输入「删除全部」四个字以继续</label>
          <input
            id="delete-confirm"
            className="input"
            type="text"
            autoComplete="off"
            value={deletePhrase}
            onChange={(event) => setDeletePhrase(event.target.value)}
            placeholder="删除全部"
          />
        </div>
      </Modal>

      <Modal
        open={restoreOpen}
        onClose={() => setRestoreOpen(false)}
        title="恢复档案"
        sub="v2 暂不提供覆盖恢复"
        icon="import"
        footer={<button className="btn btn-secondary" type="button" onClick={() => setRestoreOpen(false)}>知道了</button>}
      >
        <p style={{ fontSize: 13, lineHeight: 1.7 }}>
          先导出 JSON 备份是本版本唯一安全的迁移路径。覆盖恢复会引入跨版本迁移风险，因此 v2 只提供导出；删除全部数据后重新导入照片即可重建档案。
        </p>
      </Modal>
    </Screen>
  );
}
