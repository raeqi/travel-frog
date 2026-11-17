import { useState } from 'react';
import { useStore } from '../state';
import { navigate, routePath } from '../lib/router';
import { Modal } from '../components/Modal';

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <label className="switch">
      <input
        type="checkbox"
        checked={checked}
        aria-label={label}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="track" />
      <span>{checked ? '开启' : '关闭'}</span>
    </label>
  );
}

export function SettingsPage() {
  const { data, setSettings, exportJson, resetAll, loadDemo, notify } = useStore();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { settings } = data;
  const photoCount = Object.keys(data.photos).length;

  return (
    <section className="screen is-active" id="screen-settings">
      <div className="settings-wrap">
        <div className="settings-head">
          <div className="page-title-block">
            <div className="title-line">
              <span className="priority p1">P1</span>
              <h1>设置与隐私</h1>
              <span className="chip">显式授权</span>
            </div>
            <p className="page-desc">默认最小权限：原图不出设备、云同步关闭、只同步城市级位置。每一项都可以单独撤回。</p>
          </div>
          <span className="hint">本地模式 · 当前不会发起任何上传</span>
        </div>

        <div className="settings-list">
          <section className="settings-group" aria-label="隐私设置">
            <div className="settings-group-head">
              <h2>隐私</h2>
              <span>默认最小权限</span>
            </div>
            <div className="setting-row">
              <div>
                <div className="s-title">原图不出设备</div>
                <div className="s-desc">照片原图只在浏览器本地解析，导入、回放和导出都不请求原图。默认开启；关闭后会提示风险。</div>
              </div>
              <div className="setting-control">
                <Toggle
                  checked={settings.rawPhotoLocal}
                  label="原图不出设备"
                  onChange={(next) => {
                    setSettings({ rawPhotoLocal: next });
                    notify(next ? '已开启：原图只在本机读取' : '已关闭保护：原图有可能离开设备，请谨慎使用');
                  }}
                />
              </div>
            </div>
            <div className="setting-row">
              <div>
                <div className="s-title">云同步</div>
                <div className="s-desc">默认关闭。开启后只同步城市、时间、照片计数与一句话记忆，不同步原图。v1 只保存这个偏好，不会发起网络请求。</div>
              </div>
              <div className="setting-control">
                <Toggle
                  checked={settings.cloudSync}
                  label="云同步"
                  onChange={(next) => {
                    setSettings({ cloudSync: next });
                    notify(next
                      ? '已开启云同步偏好（v1 不会上传任何数据）'
                      : '已关闭云同步，本地数据不受影响');
                  }}
                />
              </div>
            </div>
            <div className="setting-row">
              <div>
                <div className="s-title">只同步城市级位置</div>
                <div className="s-desc">即使开启同步，也只写入城市与站点级位置，不写入精确经纬度；地图落点由本地数据渲染。</div>
              </div>
              <div className="setting-control">
                <Toggle
                  checked={settings.cityLevelOnly}
                  label="只同步城市级位置"
                  onChange={(next) => {
                    setSettings({ cityLevelOnly: next });
                    notify(next ? '已开启：只保留城市级位置' : '已关闭：同步时可能包含精确坐标');
                  }}
                />
              </div>
            </div>
          </section>

          <section className="settings-group" aria-label="数据设置">
            <div className="settings-group-head">
              <h2>数据</h2>
              <span>都在本机生成</span>
            </div>
            <div className="setting-row">
              <div>
                <div className="s-title">导出 JSON</div>
                <div className="s-desc">导出 Trip、Visit、Photo 索引与记忆文字；不包含照片原图与缩略图，可用于迁移或备份。当前 {data.trips.length} 趟 · {photoCount} 张照片。</div>
              </div>
              <div className="setting-control">
                <div className="setting-actions">
                  <button className="btn btn-sm" type="button" onClick={exportJson}>导出 JSON</button>
                </div>
              </div>
            </div>
            <div className="setting-row">
              <div>
                <div className="s-title">载入示例档案</div>
                <div className="s-desc">用 5 趟示例 Trip 覆盖当前本地数据，方便演示回放、地图与缺口清单。原图不会被读取。</div>
              </div>
              <div className="setting-control">
                <div className="setting-actions">
                  <button className="btn btn-sm" type="button" onClick={loadDemo}>载入示例档案</button>
                </div>
              </div>
            </div>
            <div className="setting-row">
              <div>
                <div className="s-title">删除全部数据</div>
                <div className="s-desc">删除本机的所有 Trip、记忆与位置索引，不可恢复。删除前需要再次确认。</div>
              </div>
              <div className="setting-control">
                <div className="setting-actions">
                  <button className="btn btn-sm btn-danger" type="button" onClick={() => setConfirmDelete(true)}>删除全部数据</button>
                </div>
              </div>
            </div>
          </section>

          <section className="settings-group" aria-label="账号设置">
            <div className="settings-group-head">
              <h2>账号</h2>
              <span>无需登录</span>
            </div>
            <div className="setting-row">
              <div>
                <div className="s-title">当前仅本地</div>
                <div className="s-desc">没有账号体系，不收集邮箱与设备标识。换设备时通过导出的 JSON 手动迁移。</div>
              </div>
              <div className="setting-control">
                <span className="chip">本地模式</span>
                <span className="hint mono">未登录</span>
              </div>
            </div>
          </section>
        </div>

        <div className="privacy-principle">
          <h3>三条承诺</h3>
          <ul>
            <li>原图默认不出设备</li>
            <li>同步默认关闭，开启需单独授权</li>
            <li>位置只到城市级，精确坐标本地留存</li>
          </ul>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
          <button className="link-btn" type="button" onClick={() => navigate(routePath('home'))}>← 回到我的地图</button>
        </div>
      </div>

      <Modal
        open={confirmDelete}
        title="删除全部数据"
        subtitle="这一步不可恢复"
        onClose={() => setConfirmDelete(false)}
        footer={
          <>
            <span className="foot-note">将清空本地 IndexedDB / localStorage 中的旅行档案</span>
            <div className="modal-actions">
              <button className="btn" type="button" onClick={() => setConfirmDelete(false)}>取消</button>
              <button
                className="btn btn-danger"
                type="button"
                onClick={() => {
                  resetAll();
                  setConfirmDelete(false);
                  navigate(routePath('home'));
                }}
              >
                确认删除
              </button>
            </div>
          </>
        }
      >
        <p className="modal-lead">将删除 {data.trips.length} 趟 Trip、{photoCount} 张照片索引与全部记忆文字。</p>
        <p className="modal-hint">照片原图从未上传，也不会被这次操作影响；被删除的只是本机的旅行档案。建议先导出 JSON 备份。</p>
      </Modal>
    </section>
  );
}
