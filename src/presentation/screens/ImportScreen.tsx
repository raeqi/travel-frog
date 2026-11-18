import { useMemo, useRef, useState, type DragEvent, type InputHTMLAttributes } from 'react';
import { DEFAULT_SPLIT_CONFIG } from '../../domain/services/split-trips';
import type { Candidate } from '../../domain/candidate/candidate';
import type { ImportSummary } from '../../application/import-photos';
import { useArchive, useService } from '../context';
import { cityLabel, countryLabel, fmtLocalDate, fmtLocalRange, fromDateTimeLocal, toDateTimeLocal } from '../format';
import { Icon } from '../icons';
import { candidateReasons, candidateTitle, issueLabel, monthDayLabel } from '../labels';
import { navigate, tripHref } from '../router';
import { captureOffsetOf, pendingCandidates, photosByIds } from '../selectors';
import { Badge, LoadingState, Modal, PageHead, PhotoThumb, Screen, useAction, useToast } from '../ui';

const directoryProps = { webkitdirectory: '', directory: '' } as unknown as InputHTMLAttributes<HTMLInputElement>;

export function ImportScreen() {
  const snapshot = useArchive();
  const service = useService();
  const { busy, run } = useAction();
  const toast = useToast();
  const [progress, setProgress] = useState<{ done: number; total: number; fileName: string } | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [ignoredOpen, setIgnoredOpen] = useState(false);
  const [splitTarget, setSplitTarget] = useState<Candidate | null>(null);
  const [splitValue, setSplitValue] = useState('');
  const [dragging, setDragging] = useState(false);
  const filesRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  const pending = pendingCandidates(snapshot);
  const ignored = snapshot.candidates.filter((candidate) => candidate.status === 'ignored');
  const recentBatch = snapshot.batches[0] ?? null;
  const recentIssues = snapshot.issues.slice(0, 6);

  const selectedPending = useMemo(() => pending.filter((candidate) => selected.has(candidate.id)), [pending, selected]);

  if (snapshot.status === 'loading') {
    return (
      <Screen name="import">
        <LoadingState note="正在读取本地档案索引…" />
      </Screen>
    );
  }

  const scan = (files: readonly File[]) => {
    if (files.length === 0) return;
    void run(
      async () => {
        setProgress({ done: 0, total: files.length, fileName: '' });
        const result = await service.importFiles(files, (item) => setProgress(item));
        setSummary(result);
        setProgress(null);
      },
      { error: '导入失败' },
    ).finally(() => setProgress(null));
  };

  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    scan(Array.from(list));
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    handleFiles(event.dataTransfer.files);
  };

  const toggle = (candidateId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(candidateId)) next.delete(candidateId);
      else next.add(candidateId);
      return next;
    });
  };

  const confirmOne = async (candidateId: string) => {
    let tripId: string | null = null;
    await run(
      async () => {
        tripId = await service.confirmCandidate(candidateId);
      },
      { success: '旅程已确认并写入档案' },
    );
    setSelected((current) => {
      const next = new Set(current);
      next.delete(candidateId);
      return next;
    });
    if (tripId) navigate(tripHref(tripId).replace(/^#\//, ''));
  };

  const confirmSelected = async () => {
    if (selectedPending.length === 0) return;
    const ids = selectedPending.map((candidate) => candidate.id);
    await run(
      async () => {
        for (const id of ids) await service.confirmCandidate(id);
      },
      { success: `已确认 ${ids.length} 段候选` },
    );
    setSelected(new Set());
  };

  const mergeSelected = async () => {
    const [first, second] = selectedPending;
    if (!first || !second || selectedPending.length !== 2) return;
    await run(
      async () => {
        await service.mergeCandidates(first.id, second.id);
      },
      { success: '已合并为一段候选，原候选保留状态记录' },
    );
    setSelected(new Set());
  };

  const openSplit = (candidate: Candidate) => {
    const midpoint = candidate.timeRange.start + (candidate.timeRange.end - candidate.timeRange.start) / 2;
    setSplitTarget(candidate);
    setSplitValue(toDateTimeLocal(midpoint));
  };

  const submitSplit = async () => {
    if (!splitTarget) return;
    const at = fromDateTimeLocal(splitValue);
    if (at === null) {
      toast.push({ tone: 'warning', title: '请选择有效的拆分时间' });
      return;
    }
    const target = splitTarget;
    const ok = await run(
      async () => {
        await service.splitCandidate(target.id, at);
      },
      { success: '已拆分为两段候选' },
    );
    if (ok) {
      setSplitTarget(null);
      setSelected(new Set());
    }
  };

  const restore = async (candidateId: string) => {
    await run(
      async () => {
        await service.restoreCandidate(candidateId);
      },
      { success: '候选已恢复为待确认' },
    );
  };

  return (
    <Screen name="import">
      <PageHead
        crumb={<><a href="#/home">首页</a><span className="sep">/</span><span>导入</span></>}
        title="导入照片"
        lede="从整个文件夹开始，自动切出候选旅程；确认后才写入档案。解析、切分与缩略图全部在本机完成。"
        actions={
          <div className="stepper" aria-label="导入步骤">
            <span className="step is-active"><span className="step-num">1</span>选择照片</span>
            <span className="step-line" />
            <span className={`step${pending.length === 0 && snapshot.trips.length > 0 ? ' is-active' : ''}`}><span className="step-num">2</span>确认候选</span>
            <span className="step-line" />
            <span className="step"><span className="step-num">3</span>进入档案</span>
          </div>
        }
      />

      <div className="import-layout">
        <div>
          <div
            className={`dropzone${dragging ? ' is-dragover' : ''}`}
            role="button"
            tabIndex={0}
            aria-label="拖入文件夹或选择照片"
            onClick={() => filesRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                filesRef.current?.click();
              }
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <div className="drop-icon"><Icon name="folder" /></div>
            <div className="drop-copy">
              <h2>把整个文件夹拖进来，或选择照片</h2>
              <p>JPG / PNG / WebP / HEIC · 读取拍摄时间、GPS 与朝向。无法解码的文件会保留为问题条目。</p>
              <div className="drop-actions" onClick={(event) => event.stopPropagation()}>
                <button className="btn btn-primary btn-sm" type="button" disabled={busy} onClick={() => filesRef.current?.click()}>
                  选择照片
                </button>
                <button className="btn btn-ghost btn-sm" type="button" disabled={busy} onClick={() => folderRef.current?.click()}>
                  选择文件夹
                </button>
                <span className="privacy-note"><Icon name="lock" />只在本机解析 EXIF，不上传原图</span>
              </div>
            </div>
            <input ref={filesRef} type="file" accept="image/*" multiple hidden onChange={(event) => { handleFiles(event.target.files); event.target.value = ''; }} />
            <input ref={folderRef} type="file" accept="image/*" multiple hidden {...directoryProps} onChange={(event) => { handleFiles(event.target.files); event.target.value = ''; }} />
          </div>

          {progress ? (
            <div className="scan-summary" role="status" aria-live="polite">
              <div className="scan-summary-top">
                <span><b>正在解析</b> · {progress.fileName || '准备中'}</span>
                <span className="mono">{progress.total === 0 ? 0 : Math.round((progress.done / progress.total) * 100)}%</span>
              </div>
              <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done}>
                <i style={{ width: `${progress.total === 0 ? 0 : (progress.done / progress.total) * 100}%` }} />
              </div>
              <p className="scan-hint">已处理 {progress.done} / {progress.total} 张 · 缩略图与指纹都在本机生成</p>
            </div>
          ) : null}

          {summary ? (
            <div className="scan-summary">
              <div className="scan-summary-top">
                <span><b>扫描完成</b> · {summary.imported} 张照片 · 找到 {summary.candidateCount} 段候选</span>
                <span className="mono">100%</span>
              </div>
              <div className="progress" role="progressbar" aria-label="扫描进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={100}>
                <i style={{ width: '100%' }} />
              </div>
              <p className="scan-hint">
                {summary.duplicates} 张重复已跳过 · {summary.failed} 个文件失败 · {summary.issues.length} 条导入问题
                {summary.issues.length > 0 ? `（${summary.issues.slice(0, 2).map(issueLabel).join('；')}）` : ''}
              </p>
            </div>
          ) : null}

          <div className="cand-toolbar">
            <h2>候选旅程</h2>
            <span className="count">{pending.length} 段</span>
            <span className="muted" style={{ fontSize: 11.5 }}>按时间正序 · 勾选后可合并或批量确认</span>
            <div className="right hstack">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={pending.length > 0 && selected.size === pending.length}
                  onChange={(event) => setSelected(event.target.checked ? new Set(pending.map((candidate) => candidate.id)) : new Set())}
                />
                全选
              </label>
            </div>
          </div>

          <div className="cand-list">
            {pending.map((candidate) => (
              <CandidateCard
                key={candidate.id}
                candidate={candidate}
                checked={selected.has(candidate.id)}
                expanded={expanded === candidate.id}
                busy={busy}
                onToggle={() => toggle(candidate.id)}
                onExpand={() => setExpanded(expanded === candidate.id ? null : candidate.id)}
                onConfirm={() => void confirmOne(candidate.id)}
                onSplit={() => openSplit(candidate)}
              />
            ))}
          </div>

          {pending.length === 0 && !progress ? (
            <div className="empty empty-inline">
              <div className="empty-icon"><Icon name="import" /></div>
              <h3>没有待确认的旅程</h3>
              <p>当前档案里没有候选。选择新的照片后，切分结果会出现在这里；已确认的旅程不会重复导入。</p>
            </div>
          ) : null}

          {ignored.length > 0 ? (
            <div className="card" style={{ marginTop: 16 }}>
              <button className="card-head" type="button" style={{ width: '100%', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left' }} onClick={() => setIgnoredOpen(!ignoredOpen)} aria-expanded={ignoredOpen}>
                <div>
                  <h3>已忽略的候选 · {ignored.length}</h3>
                  <div className="sub">状态记录保留，可随时恢复</div>
                </div>
                <Icon name={ignoredOpen ? 'chevron-down' : 'chevron-right'} className="icon icon-sm" />
              </button>
              {ignoredOpen ? (
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {ignored.map((candidate) => (
                    <div key={candidate.id} className="hstack" style={{ justifyContent: 'space-between', gap: 12 }}>
                      <span style={{ minWidth: 0 }}>
                        <b style={{ fontSize: 12 }}>{candidateTitle(candidate, captureOffsetOf(photosByIds(snapshot, candidate.photoIds)))}</b>
                        <span className="muted" style={{ display: 'block', fontSize: 10.5 }}>{fmtLocalRange(candidate.timeRange, captureOffsetOf(photosByIds(snapshot, candidate.photoIds)))} · {candidate.photoIds.length} 张</span>
                      </span>
                      <button className="btn btn-xs btn-secondary" type="button" disabled={busy} onClick={() => void restore(candidate.id)}>恢复</button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="batch-bar" role="region" aria-label="批量操作">
            <div className="batch-info">
              <Icon name="check" className="icon icon-sm" />
              <b>待确认 {pending.length} / {pending.length}</b>
              <span>已选 {selectedPending.length} 段 · {selectedPending.reduce((sum, candidate) => sum + candidate.photoIds.length, 0)} 张</span>
              <span className="privacy-note"><Icon name="lock" />全部在本机完成</span>
            </div>
            <div className="batch-actions">
              <button className="btn btn-secondary btn-sm" type="button" disabled={busy || selectedPending.length !== 2} onClick={() => void mergeSelected()}>合并所选</button>
              <button className="btn btn-secondary btn-sm" type="button" disabled={busy || selectedPending.length === 0} onClick={() => void confirmSelected()}>确认所选</button>
              <button className="btn btn-primary btn-sm" type="button" disabled={busy || pending.length === 0} onClick={() => void run(async () => { await service.confirmAll(); }, { success: '已确认全部候选' })}>全部确认</button>
            </div>
          </div>
        </div>

        <aside className="config-card">
          <div className="card">
            <div className="card-head">
              <div>
                <h3>切分参数</h3>
                <div className="sub">自动切分使用同一组领域常量</div>
              </div>
              <span className="badge badge-neutral">只读</span>
            </div>
            <div className="card-body" style={{ paddingTop: 6, paddingBottom: 6 }}>
              <ConfigRow label="相邻切分间隔" value={`${DEFAULT_SPLIT_CONFIG.maxGapHours} h`} />
              <ConfigRow label="远距离阈值" value={`${DEFAULT_SPLIT_CONFIG.maxDistanceKm} km`} />
              <ConfigRow label="远距离静默" value={`${DEFAULT_SPLIT_CONFIG.farPlaceHours} h`} />
              <ConfigRow label="单段最长天数" value={`${DEFAULT_SPLIT_CONFIG.maxTripDays} 天`} />
              <ConfigRow label="站点聚合半径" value={`${DEFAULT_SPLIT_CONFIG.visitRadiusKm} km`} />
              <ConfigRow label="站点静默" value={`${DEFAULT_SPLIT_CONFIG.visitGapHours} h`} />
              <p className="config-note">参数越界会拒绝导入并返回 `CONFIG_INVALID`，不会悄悄回退默认值。单张照片候选允许存在，但会标为低置信。</p>
            </div>
          </div>
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-head"><h3>本次导入</h3></div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="hstack"><span className="mini-label">文件</span><span className="grow" /><span className="mono" style={{ fontSize: 11 }}>{recentBatch?.sourceFileCount ?? 0}</span></div>
              <div className="hstack"><span className="mini-label">照片</span><span className="grow" /><span className="mono" style={{ fontSize: 11 }}>{recentBatch?.photoCount ?? 0}</span></div>
              <div className="hstack"><span className="mini-label">问题</span><span className="grow" /><span className="mono text-pending" style={{ fontSize: 11 }}>{recentBatch?.issueCount ?? 0}</span></div>
              <div className="hstack"><span className="mini-label">候选</span><span className="grow" /><span className="mono" style={{ fontSize: 11 }}>{recentBatch?.candidateCount ?? 0}</span></div>
              <hr className="divider" />
              <div className="hstack" style={{ fontSize: 10.5, color: 'var(--color-text-tertiary)' }}>
                <Icon name="info" className="icon icon-xs" />
                <span>已按 SHA-256 指纹去重 · 重复文件会记录为问题</span>
              </div>
            </div>
          </div>
          {recentIssues.length > 0 ? (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-head"><h3>最近的问题</h3><span className="pill-count">{snapshot.issues.length}</span></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {recentIssues.map((issue) => (
                  <div key={issue.id} className="hstack" style={{ gap: 6, alignItems: 'flex-start' }}>
                    <Icon name={issue.severity === 'error' ? 'alert' : 'info'} className="icon icon-xs" />
                    <span style={{ fontSize: 10.5, color: issue.severity === 'error' ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}>
                      {issue.fileName} · {issueLabel(issue)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
      </div>

      <Modal
        open={splitTarget !== null}
        onClose={() => setSplitTarget(null)}
        title="拆分候选旅程"
        {...(splitTarget ? { sub: `${candidateTitle(splitTarget, captureOffsetOf(photosByIds(snapshot, splitTarget.photoIds)))} · ${fmtLocalRange(splitTarget.timeRange, captureOffsetOf(photosByIds(snapshot, splitTarget.photoIds)))}` } : {})}
        icon="split"
        footer={
          <>
            <button className="btn btn-secondary" type="button" onClick={() => setSplitTarget(null)}>取消</button>
            <button className="btn btn-primary" type="button" disabled={busy} onClick={() => void submitSplit()}>拆分为两段</button>
          </>
        }
      >
        <p className="muted" style={{ fontSize: 12, lineHeight: '19px' }}>
          拆分点必须位于候选时间范围内，且两侧至少各有一张照片。拆分后原候选标记为 split，并保留指向两段新候选的记录。
        </p>
        <label className="field">
          <span className="field-label">拆分时间（UTC）</span>
          <input className="input" type="datetime-local" value={splitValue} onChange={(event) => setSplitValue(event.target.value)} />
        </label>
      </Modal>
    </Screen>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="config-row">
      <span className="label">{label}</span>
      <span className="val">{value}</span>
    </div>
  );
}

function CandidateCard({
  candidate,
  checked,
  expanded,
  busy,
  onToggle,
  onExpand,
  onConfirm,
  onSplit,
}: {
  candidate: Candidate;
  checked: boolean;
  expanded: boolean;
  busy: boolean;
  onToggle: () => void;
  onExpand: () => void;
  onConfirm: () => void;
  onSplit: () => void;
}) {
  const snapshot = useArchive();
  const photos = photosByIds(snapshot, candidate.photoIds);
  const cover = photos[0];
  const offset = captureOffsetOf(photos);
  return (
    <article className="cand-card">
      <div className="cand-main">
        <label className="checkbox" aria-label={`选择候选 ${candidateTitle(candidate, offset)}`}>
          <input type="checkbox" className="cand-check" checked={checked} onChange={onToggle} />
        </label>
        {cover ? (
          <PhotoThumb photo={cover} className="cand-cover" label={`${candidate.photoIds.length} 张`} />
        ) : (
          <div className="cand-cover ph"><span className="ph-art" /><span className="ph-label">{candidate.photoIds.length} 张</span></div>
        )}
        <div className="cand-maintext">
          <div className="cand-title">
            <span className="name">{candidateTitle(candidate, offset)}</span>
            <Badge tone="pending">待确认</Badge>
            <Badge tone={candidate.confidence === 'high' ? 'confirmed' : 'pending'}>{candidate.confidence === 'high' ? '高置信' : '低置信'}</Badge>
            {candidate.origin === 'demo' ? <Badge tone="neutral">示例</Badge> : null}
          </div>
          <div className="cand-meta">
            <span className="mono">{fmtLocalRange(candidate.timeRange, offset)}</span>
            <span className="sep">·</span>
            <span>{countryLabel(candidate.cityRefs)} · {cityLabel(candidate.cityRefs)}</span>
            <span className="sep">·</span>
            <span>{candidate.photoIds.length} 张</span>
            <span className="sep">·</span>
            <span className={candidate.locationMissingCount > 0 ? 'text-pending' : undefined}>
              {candidate.locationMissingCount > 0 ? `${candidate.locationMissingCount} 张缺定位` : '定位完整'}
            </span>
          </div>
          <div className="cand-reason">
            <Icon name={candidate.confidence === 'high' ? 'info' : 'alert'} className="icon icon-xs" />
            切分原因：{candidateReasons(candidate)} · 日期 {fmtLocalRange(candidate.timeRange, offset)}
          </div>
        </div>
        <div className="cand-actions">
          <button className="btn btn-sm btn-secondary" type="button" disabled={busy} onClick={onConfirm}>确认</button>
          <button className="btn btn-xs btn-ghost" type="button" disabled={busy} onClick={onSplit}>拆分</button>
          <button className="icon-btn icon-btn-sm" type="button" aria-label="展开候选详情" aria-expanded={expanded} onClick={onExpand}>
            <Icon name={expanded ? 'chevron-down' : 'chevron-right'} className="icon icon-sm" />
          </button>
        </div>
      </div>
      {expanded ? (
        <div className="cand-expand">
          <div className="cand-thumbs">
            {photos.slice(0, 5).map((photo) => (
              <PhotoThumb key={photo.id} photo={photo} />
            ))}
          </div>
          <span>
            {cityLabel(candidate.cityRefs, 4)} · {monthDayLabel(fmtLocalDate(candidate.timeRange.start, offset))} 起
            {photos.length > 5 ? ` · 另 ${photos.length - 5} 张` : ''}
          </span>
        </div>
      ) : null}
    </article>
  );
}
