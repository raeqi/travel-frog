import { useMemo, useState } from 'react';
import type { LocationSuggestion } from '../../domain/services/fill-locations';
import type { Photo } from '../../domain/photo/photo';
import { useArchive, useService } from '../context';
import { fmtLocalDate, fmtLocalTime, percent } from '../format';
import { Icon } from '../icons';
import { groupByDay, monthDayLabel, relativeMinutes } from '../labels';
import { unlocatedPhotos } from '../selectors';
import { EmptyState, LoadingState, PageHead, PhotoThumb, Screen, useAction, useToast } from '../ui';

interface Row {
  photo: Photo;
  suggestion: LocationSuggestion | null;
}

const SOURCE_LABEL = {
  'same-day-gps': '同日 GPS',
  'nearest-in-time': '临近时间',
} as const;

export function FillScreen() {
  const snapshot = useArchive();
  const service = useService();
  const { busy, run } = useAction();
  const toast = useToast();
  const [day, setDay] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewId, setPreviewId] = useState<string | null>(null);

  const suggestions = useMemo(() => service.suggestions(), [service, snapshot]);
  const suggestionByPhoto = useMemo(() => new Map(suggestions.map((item) => [item.photoId, item])), [suggestions]);
  const targets = useMemo(() => unlocatedPhotos(snapshot), [snapshot]);
  const rows: Row[] = useMemo(
    () => targets.map((photo) => ({ photo, suggestion: suggestionByPhoto.get(photo.id) ?? null })),
    [targets, suggestionByPhoto],
  );
  const dayGroups = useMemo(() => groupByDay(rows, (row) => row.photo.capturedAt, (row) => row.photo.captureOffsetMinutes), [rows]);
  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (day !== 'all' && fmtLocalDate(row.photo.capturedAt, row.photo.captureOffsetMinutes) !== day) return false;
      if (query.trim().length > 0 && !row.photo.fileName.toLocaleLowerCase('zh-CN').includes(query.trim().toLocaleLowerCase('zh-CN'))) return false;
      return true;
    });
  }, [rows, day, query]);

  const preview = rows.find((row) => row.photo.id === previewId) ?? filtered[0] ?? null;
  const selectable = filtered.filter((row) => row.suggestion !== null);
  const selectedRows = filtered.filter((row) => selected.has(row.photo.id) && row.suggestion !== null);
  const allSelected = selectable.length > 0 && selectable.every((row) => selected.has(row.photo.id));

  if (snapshot.status === 'loading') {
    return (
      <Screen name="fill">
        <LoadingState note="正在按天分组并计算候选质心…" />
      </Screen>
    );
  }

  const toggle = (photoId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(photoId)) next.delete(photoId);
      else next.add(photoId);
      return next;
    });
  };

  const selectDay = () => {
    setSelected((current) => {
      const next = new Set(current);
      for (const row of selectable) {
        if (allSelected) next.delete(row.photo.id);
        else next.add(row.photo.id);
      }
      return next;
    });
  };

  const apply = async (ids: readonly string[]) => {
    if (ids.length === 0) return;
    const ok = await run(
      async () => {
        await service.applyLocationSuggestions(ids);
      },
      { success: `已补齐 ${ids.length} 张照片的位置` },
    );
    if (ok) {
      setSelected(new Set());
      setPreviewId(null);
    }
  };

  const applyOne = (row: Row) => {
    if (!row.suggestion) {
      toast.push({ tone: 'warning', title: '这张照片没有可用候选', detail: '同一天里没有带 GPS 的照片，无法自动推断。' });
      return;
    }
    void apply([row.photo.id]);
  };

  return (
    <Screen name="fill">
      <PageHead
        crumb={<><a href="#/home">首页</a><span className="sep">/</span><span>补位置</span></>}
        title="照片补位置"
        lede="这些照片没有位置信息。候选来自同一天有 GPS 的照片，按 Visit 分组求质心；没有任何候选会自动写入，必须由你确认。"
        actions={
          <>
            <span className="tag"><Icon name="pin" className="icon icon-xs" />{targets.length} 张缺定位</span>
            <button className="btn btn-primary" type="button" disabled={busy || selectedRows.length === 0} onClick={() => void apply(selectedRows.map((row) => row.photo.id))}>
              <Icon name="check" className="icon icon-sm" />确认补齐 {selectedRows.length > 0 ? `(${selectedRows.length})` : ''}
            </button>
          </>
        }
      />

      {targets.length === 0 ? (
        <EmptyState
          icon="pin"
          title="没有需要补位置的照片"
          body="所有照片都有有效 GPS，或已经确认过候选位置。补位置只在用户确认后写入，不会自动修改照片。"
          actions={<><a className="btn btn-primary btn-lg" href="#/home">返回旅程档案</a><a className="btn btn-secondary btn-lg" href="#/map">看地图</a></>}
          meta={`0 unlocated photos · 定位完整率 ${percent(snapshot.photos.length - targets.length, snapshot.photos.length)}`}
        />
      ) : (
        <div className="fill-layout">
          <section className="card fill-main" aria-label="缺定位照片列表">
            <div className="fill-toolbar">
              <span className="mini-label">按天</span>
              <div className="day-tabs" role="tablist" aria-label="按天筛选">
                <button className={`day-tab${day === 'all' ? ' is-active' : ''}`} type="button" role="tab" aria-selected={day === 'all'} onClick={() => setDay('all')}>
                  全部 <span className="n">{targets.length}</span>
                </button>
                {dayGroups.map((group) => (
                  <button key={group.key} className={`day-tab${day === group.key ? ' is-active' : ''}`} type="button" role="tab" aria-selected={day === group.key} onClick={() => setDay(group.key)}>
                    {monthDayLabel(group.key)} <span className="n">{group.items.length}</span>
                  </button>
                ))}
              </div>
              <span className="flex" />
              <div className="search-field" style={{ width: 150 }}>
                <Icon name="search" />
                <input className="input input-sm" type="search" placeholder="文件名" aria-label="搜索文件名" value={query} onChange={(event) => setQuery(event.target.value)} />
              </div>
            </div>

            <div style={{ overflow: 'auto' }}>
              <table className="fill-table">
                <thead>
                  <tr>
                    <th className="col-pick">
                      <label className="checkbox" aria-label="全选当前列表">
                        <input type="checkbox" checked={allSelected} onChange={selectDay} />
                      </label>
                    </th>
                    <th className="col-thumb">照片</th>
                    <th className="col-when">拍摄时间</th>
                    <th className="col-file">文件名</th>
                    <th>候选地点</th>
                    <th className="col-source">来源</th>
                    <th className="col-act" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.photo.id} onClick={() => setPreviewId(row.photo.id)} style={{ cursor: 'pointer' }}>
                      <td onClick={(event) => event.stopPropagation()}>
                        <label className="checkbox" aria-label={`选择 ${row.photo.fileName}`}>
                          <input type="checkbox" className="fill-check" checked={selected.has(row.photo.id)} disabled={row.suggestion === null} onChange={() => toggle(row.photo.id)} />
                        </label>
                      </td>
                      <td><PhotoThumb photo={row.photo} className="thumb" /></td>
                      <td className="mono" style={{ fontSize: 10 }}>{fmtLocalDate(row.photo.capturedAt, row.photo.captureOffsetMinutes).slice(5)} {fmtLocalTime(row.photo.capturedAt, row.photo.captureOffsetMinutes)}</td>
                      <td className="col-file"><span className="file">{row.photo.fileName}</span></td>
                      <td>
                        {row.suggestion ? (
                          <span className="fill-cand">
                            <b>{row.suggestion.cityRef.name}</b>
                            <span>{row.suggestion.reason === 'same-day-gps' ? `同日质心 · 距离 ${row.suggestion.distanceKm.toFixed(1)} km` : `最近参照 · ${relativeMinutes(row.suggestion.timeDeltaMs)}`} · 置信{row.suggestion.confidence === 'high' ? '高' : row.suggestion.confidence === 'medium' ? '中' : '低'}</span>
                          </span>
                        ) : (
                          <span className="fill-cand"><b className="text-pending">没有候选地点</b><span>同 Trip 内无有效参照 · 可稍后重试</span></span>
                        )}
                      </td>
                      <td>
                        <span className={`fill-source${row.suggestion ? '' : ' is-none'}`}>
                          <span className="dot" />
                          {row.suggestion ? `${SOURCE_LABEL[row.suggestion.reason]} · ${fmtLocalTime(row.photo.capturedAt, row.photo.captureOffsetMinutes)}` : '无候选'}
                        </span>
                      </td>
                      <td onClick={(event) => event.stopPropagation()}>
                        <button className="btn btn-xs btn-secondary" type="button" disabled={busy || row.suggestion === null} onClick={() => applyOne(row)}>套用</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 ? <p className="muted" style={{ padding: 16, fontSize: 12 }}>当前筛选下没有照片。</p> : null}
            </div>

            <div className="fill-foot">
              <div className="hstack" style={{ gap: 14, flexWrap: 'wrap' }}>
                <label className="checkbox"><input type="checkbox" checked={allSelected} onChange={selectDay} />全选当前天</label>
                <span className="fill-count">已选 <b>{selectedRows.length} / {filtered.length}</b> 张</span>
                <span className="muted" style={{ fontSize: 10.5 }}>未确认前不写入档案</span>
              </div>
              <div className="hstack">
                <button className="btn btn-sm btn-secondary" type="button" disabled={busy || selectedRows.length === 0} onClick={() => void apply(selectedRows.map((row) => row.photo.id))}>
                  批量套用
                </button>
                <button className="btn btn-sm btn-ghost" type="button" onClick={() => setSelected(new Set())}>清空所选</button>
              </div>
            </div>
          </section>

          <aside className="card preview-card" aria-label="候选落点预览">
            <div className="card-head">
              <div><h2>落点预览</h2><div className="sub">{preview?.photo.fileName ?? '选择一行照片'}</div></div>
              <span className="badge badge-pending">候选</span>
            </div>
            <div className="preview-map">
              <svg className="local-map" viewBox="0 0 360 240" role="img" aria-label="候选落点">
                <rect width="360" height="240" fill="var(--color-map-water)" />
                <g opacity={0.35}>
                  {[1, 2, 3].map((step) => <line key={step} x1="0" y1={(240 / 4) * step} x2="360" y2={(240 / 4) * step} stroke="var(--color-map-border)" strokeWidth="0.7" />)}
                  {[1, 2, 3].map((step) => <line key={`v${step}`} x1={(360 / 4) * step} y1="0" x2={(360 / 4) * step} y2="240" stroke="var(--color-map-border)" strokeWidth="0.7" />)}
                </g>
                {preview?.suggestion ? (
                  <>
                    <circle cx={180} cy={120} r={12} fill="var(--color-primary)" opacity={0.18} />
                    <circle cx={180} cy={120} r={4} fill="var(--color-primary)" />
                    <text className="geo" x={194} y={124}>{preview.suggestion.geo.lat.toFixed(3)}, {preview.suggestion.geo.lng.toFixed(3)}</text>
                  </>
                ) : (
                  <text className="geo" x={180} y={120} textAnchor="middle">NO CANDIDATE</text>
                )}
              </svg>
            </div>
            <div className="card-body" style={{ paddingTop: 12 }}>
              {preview ? (
                <>
                  <div className="preview-thumb">
                    <PhotoThumb photo={preview.photo} />
                    <div className="t">
                      <b>{preview.suggestion ? `${preview.suggestion.cityRef.name} · ${preview.suggestion.cityRef.countryName}` : '没有候选地点'}</b>
                      {preview.suggestion
                        ? `${SOURCE_LABEL[preview.suggestion.reason]} · 时间差 ${relativeMinutes(preview.suggestion.timeDeltaMs)}`
                        : '同一天没有带 GPS 的照片，无法推断'}
                      <br />
                      <span className="mono">{preview.suggestion ? `${preview.suggestion.geo.lat.toFixed(4)}, ${preview.suggestion.geo.lng.toFixed(4)}` : '—'}</span>
                    </div>
                  </div>
                  <div className="preview-info">
                    <div className="row"><span>来源</span><b>{preview.suggestion ? SOURCE_LABEL[preview.suggestion.reason] : '无'}</b></div>
                    <div className="row"><span>时间差</span><b className="mono">{preview.suggestion ? relativeMinutes(preview.suggestion.timeDeltaMs) : '—'}</b></div>
                    <div className="row"><span>置信</span><b><span className={`badge badge-${preview.suggestion?.confidence === 'high' ? 'confirmed' : 'pending'}`}>{preview.suggestion ? (preview.suggestion.confidence === 'high' ? '高' : preview.suggestion.confidence === 'medium' ? '中' : '低') : '无'}</span></b></div>
                  </div>
                  <div className="preview-note">预览只显示候选落点，不修改照片文件。确认后写入 Trip 站点索引，并标注「位置由同日照片推断」；候选坐标 approximate = true。</div>
                  <button className="btn btn-primary" style={{ width: '100%', marginTop: 10 }} type="button" disabled={busy || preview.suggestion === null} onClick={() => applyOne(preview)}>
                    确认这一条
                  </button>
                </>
              ) : (
                <p className="muted" style={{ fontSize: 12 }}>从左侧选择一张照片查看候选落点。</p>
              )}
            </div>
          </aside>
        </div>
      )}
    </Screen>
  );
}
