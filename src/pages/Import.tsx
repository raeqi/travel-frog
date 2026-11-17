import { useMemo, useRef, useState } from 'react';
import type { Candidate, Photo } from '../types';
import { useStore } from '../state';
import { parseExif } from '../lib/exif';
import { createDemoScanPhotos } from '../lib/demo';
import { fmtDate, fmtMonthDay, spanDays, startOfDay, uid } from '../lib/format';
import { splitPhotosIntoTrips } from '../lib/splitTrips';
import { navigate, routePath } from '../lib/router';
import { Modal } from '../components/Modal';
import { PhotoThumb } from '../components/PhotoThumb';

function readAllEntries(reader: FileSystemDirectoryReader): Promise<File[]> {
  return new Promise((resolve) => {
    const out: File[] = [];
    const next = () => {
      reader.readEntries(async (entries) => {
        if (!entries.length) {
          resolve(out);
          return;
        }
        for (const entry of entries) out.push(...(await readEntry(entry)));
        next();
      }, () => resolve(out));
    };
    next();
  });
}

function readEntry(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile) {
    return new Promise((resolve) => {
      (entry as FileSystemFileEntry).file((f) => resolve([f]), () => resolve([]));
    });
  }
  if (entry.isDirectory) {
    return readAllEntries((entry as FileSystemDirectoryEntry).createReader());
  }
  return Promise.resolve([]);
}

async function makeThumb(file: File): Promise<string | undefined> {
  if (!file.type.startsWith('image/') || /heic|heif/i.test(file.type) || /\.hei[cf]$/i.test(file.name)) {
    return undefined;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 320 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL('image/jpeg', 0.72);
  } catch {
    return undefined;
  }
}

const tick = () => new Promise((r) => setTimeout(r, 0));

export function ImportPage() {
  const { data, addPhotos, confirmCandidates, ignoreCandidate, restoreCandidate, mergeCandidatesInto, splitCandidateAt, notify, setConfig } = useStore();
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [scanLabel, setScanLabel] = useState('还没有开始扫描 · 照片只在本地读取');
  const [dragOver, setDragOver] = useState(false);
  const [mergeSource, setMergeSource] = useState<Candidate | null>(null);
  const [mergeTarget, setMergeTarget] = useState<string>('');
  const [splitTarget, setSplitTarget] = useState<Candidate | null>(null);
  const [splitDate, setSplitDate] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const candidates = useMemo(
    () => data.candidates.slice().sort((a, b) => b.startAt - a.startAt),
    [data.candidates],
  );
  const pending = candidates.filter((c) => c.status === 'pending');
  const active = candidates.filter((c) => c.status !== 'ignored');
  const allPhotos = pending.reduce((s, c) => s + c.photoIds.length, 0);

  const importFiles = async (files: File[]) => {
    const images = files.filter(
      (f) => f.type.startsWith('image/') || /\.(jpe?g|heic|heif|png|webp|tiff?)$/i.test(f.name),
    );
    if (!images.length) {
      notify('没有找到可读取的照片');
      return;
    }
    setScanning(true);
    setProgress(0);
    const photos: Photo[] = [];
    for (let i = 0; i < images.length; i += 1) {
      const file = images[i];
      setScanLabel(`正在读取 ${i + 1} / ${images.length} · ${file.name}`);
      let exif: ReturnType<typeof parseExif> = {};
      try {
        const head = await file.slice(0, Math.min(file.size, 512 * 1024)).arrayBuffer();
        exif = parseExif(head);
      } catch {
        exif = {};
      }
      const takenAt = exif.takenAt ?? (file.lastModified || Date.now());
      const thumb = await makeThumb(file);
      photos.push({
        id: uid('ph'),
        name: file.name,
        takenAt,
        lat: exif.lat,
        lng: exif.lng,
        thumb,
        locationSource: exif.lat != null && exif.lng != null ? 'exif' : 'none',
      });
      setProgress(Math.round(((i + 1) / images.length) * 100));
      if (i % 4 === 0) await tick();
    }
    addPhotos(photos);
    await tick();
    const groups = splitPhotosIntoTrips(photos, data.config).length;
    setProgress(100);
    setScanLabel(`扫描完成 · ${photos.length} 张照片 · 找到 ${groups} 段候选`);
    setScanning(false);
    notify(`已从 ${photos.length} 张照片中切出 ${groups} 段候选`);
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const entries: FileSystemEntry[] = [];
    const items = Array.from(e.dataTransfer.items ?? []);
    for (const item of items) {
      const entry = item.webkitGetAsEntry?.();
      if (entry) entries.push(entry);
    }
    if (entries.length) {
      const files: File[] = [];
      for (const entry of entries) files.push(...(await readEntry(entry)));
      await importFiles(files);
    } else {
      await importFiles(Array.from(e.dataTransfer.files ?? []));
    }
  };

  const runDemoScan = async () => {
    setScanning(true);
    setProgress(0);
    setScanLabel('示例扫描 · 读取合成照片的时间与 GPS…');
    for (const pct of [18, 42, 67, 88, 100]) {
      await new Promise((r) => setTimeout(r, 110));
      setProgress(pct);
    }
    const demoPhotos = createDemoScanPhotos();
    const groups = splitPhotosIntoTrips(demoPhotos, data.config).length;
    addPhotos(demoPhotos);
    await tick();
    setScanLabel(`扫描完成 · ${demoPhotos.length} 张示例照片 · 找到 ${groups} 段候选`);
    setScanning(false);
    notify(`示例扫描完成：${groups} 段候选，全部在本地生成`);
  };

  const splitDays = useMemo(() => {
    if (!splitTarget) return [];
    const days: number[] = [];
    let t = startOfDay(splitTarget.startAt);
    const end = startOfDay(splitTarget.endAt);
    while (t <= end) {
      days.push(t);
      t += 86_400_000;
    }
    return days;
  }, [splitTarget]);

  const openMerge = (c: Candidate) => {
    const others = pending.filter((x) => x.id !== c.id);
    if (!others.length) {
      notify('没有其他待合并的候选');
      return;
    }
    setMergeSource(c);
    setMergeTarget(others[0].id);
  };

  const doMerge = () => {
    if (!mergeSource || !mergeTarget) return;
    mergeCandidatesInto(mergeSource.id, mergeTarget);
    setMergeSource(null);
    notify('已合并为 1 段候选');
  };

  const openSplit = (c: Candidate) => {
    const days = [];
    let t = startOfDay(c.startAt) + 86_400_000;
    while (t <= startOfDay(c.endAt)) {
      days.push(t);
      t += 86_400_000;
    }
    if (!days.length) {
      notify('这一段只有 1 天，无法拆分');
      return;
    }
    setSplitTarget(c);
    setSplitDate(fmtDate(days[0]));
  };

  const doSplit = () => {
    if (!splitTarget || !splitDate) return;
    const at = new Date(`${splitDate}T00:00:00`).getTime();
    const ok = splitCandidateAt(splitTarget.id, at);
    setSplitTarget(null);
    notify(ok ? `已在 ${splitDate} 之后拆分为 2 段` : '这个日期无法拆分，请换一天');
  };

  return (
    <section className="screen is-active" id="screen-import">
      <div className="import-wrap">
        <div className="page-head">
          <div>
            <div className="title-line"><span className="priority p0">P0</span><h1>导入照片</h1></div>
            <p>从整个文件夹开始，自动切出候选行程；确认后才会写入我的地图。</p>
          </div>
          <span className="page-step">步骤 1 / 2 · 导入与确认</span>
        </div>

        <div className="upload-panel">
          <div
            ref={dropRef}
            className={`dropzone ${dragOver ? 'is-over' : ''}`}
            role="button"
            tabIndex={0}
            aria-label="拖拽照片文件夹或选择照片"
            onClick={(e) => {
              if ((e.target as HTMLElement).closest('button, a, label')) return;
              fileInput.current?.click();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInput.current?.click();
              }
            }}
            onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
            onDrop={onDrop}
          >
            <div className="drop-icon" />
            <h2>把整个文件夹拖进来，或选择照片</h2>
            <p>支持 JPG / HEIC · 会读取拍摄时间与 GPS，用来切分行程</p>
            <div className="drop-actions">
              <button className="btn btn-primary btn-sm" type="button" onClick={() => fileInput.current?.click()}>选择照片</button>
              <button className="btn btn-sm" type="button" onClick={() => folderInput.current?.click()}>选择文件夹</button>
              <button className="link-btn" type="button" onClick={runDemoScan} disabled={scanning}>没有照片？试用示例扫描</button>
              <span className="privacy-note">只在本地解析 EXIF，不上传原图</span>
            </div>
          </div>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept="image/*"
            hidden
            onChange={(e) => {
              void importFiles(Array.from(e.target.files ?? []));
              e.target.value = '';
            }}
          />
          <input
            ref={(el) => {
              folderInput.current = el;
              if (el) el.setAttribute('webkitdirectory', '');
            }}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              void importFiles(Array.from(e.target.files ?? []));
              e.target.value = '';
            }}
          />
          <div className="scan-block">
            <div className="scan-row">
              <span>{scanLabel}</span>
              <span className="mono">{progress}%</span>
            </div>
            <div className="progress" role="progressbar" aria-label="扫描进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
              <i style={{ width: `${progress}%` }} />
            </div>
            <p className="scan-hint">
              切分规则：时间相邻 + 地理接近 + 连续天数；时区或跨城异常会先标为待确认。所有解析都在本机完成。
            </p>
            <div className="split-config" aria-label="切分参数">
              <span className="toolbar-label">切分参数</span>
              <label>时间间隔 <input type="number" min={2} max={240} value={data.config.maxGapHours} onChange={(e) => setConfig({ maxGapHours: Number(e.target.value) || 1 })} /> 小时</label>
              <label>距离阈值 <input type="number" min={10} max={5000} value={data.config.maxDistanceKm} onChange={(e) => setConfig({ maxDistanceKm: Number(e.target.value) || 1 })} /> km</label>
              <label>远距静默 <input type="number" min={1} max={72} value={data.config.farPlaceHours} onChange={(e) => setConfig({ farPlaceHours: Number(e.target.value) || 1 })} /> 小时</label>
              <label>连续天数 <input type="number" min={1} max={90} value={data.config.maxTripDays} onChange={(e) => setConfig({ maxTripDays: Number(e.target.value) || 1 })} /> 天</label>
            </div>
          </div>
        </div>

        <div className="cand-head">
          <div>
            <h2>候选行程 <span>{active.length}</span></h2>
            <p>按时间倒序 · 确认 / 合并 / 拆分 / 忽略后再写入我的地图</p>
          </div>
          <span className="cand-summary">
            {active.length} 个候选 · {allPhotos} 张照片 · 待确认 {pending.length}
          </span>
        </div>

        <div className="cand-list">
          {candidates.map((c, i) => {
            const cover = data.photos[c.photoIds[0]]?.thumb;
            return (
              <article key={c.id} className={`cand-card ${c.status === 'ignored' ? 'is-ignored' : ''} ${c.locationMissing ? 'has-warn' : ''}`}>
                <PhotoThumb className="cand-cover photo" thumb={cover} label="封面" caption={c.cityNames[0]} />
                <div className="cand-body">
                  <div className="cand-kicker">
                    <span className="cand-no">候选 {String(i + 1).padStart(2, '0')}</span>
                    <span className="chip">{c.status === 'ignored' ? '已忽略' : '待确认'}</span>
                    {c.locationMissing > 0 && (
                      <span className="warn-chip"><i>!</i>缺少位置信息 {c.locationMissing} 张</span>
                    )}
                  </div>
                  <h3>{c.cityNames.join(' / ')}</h3>
                  <div className="cand-facts">
                    <span className="mono">{fmtDate(c.startAt)} ~ {fmtDate(c.endAt)}</span>
                    <span>{spanDays(c.startAt, c.endAt)} 天</span>
                    <span>{c.photoIds.length} 张照片</span>
                    <span>{c.cityNames.length} 城</span>
                  </div>
                  <div className="cand-route">
                    {c.cityNames.map((city, idx) => (
                      <span key={`${city}-${idx}`}>
                        {idx > 0 ? <b>→</b> : null}
                        <span>{city}</span>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="cand-actions">
                  {c.status === 'ignored' ? (
                    <>
                      <button className="btn btn-sm" type="button" onClick={() => restoreCandidate(c.id)}>撤销忽略</button>
                      <span className="action-note">不生成旅程</span>
                    </>
                  ) : (
                    <>
                      <button className="btn btn-sm btn-primary" type="button" onClick={() => { confirmCandidates([c.id]); notify(`已确认「${c.cityNames.join(' / ')}」· ${c.photoIds.length} 张照片`); }}>确认</button>
                      <button className="btn btn-sm" type="button" onClick={() => openMerge(c)}>合并</button>
                      <button className="btn btn-sm" type="button" onClick={() => openSplit(c)}>拆分</button>
                      <button className="btn btn-sm" type="button" onClick={() => { ignoreCandidate(c.id); notify(`已忽略「${c.cityNames.join(' / ')}」，可在卡片上撤销`); }}>忽略</button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
          {!candidates.length && (
            <div className="cand-empty">
              还没有候选。把一次旅行的照片拖进来，或先点「试用示例扫描」看看完整流程。
            </div>
          )}
        </div>

        <div className="batch-bar">
          <div className="batch-info">
            <i className="batch-mark" />
            <b>待确认 {pending.length} / {active.length}</b>
            <span>全部解析在本机完成 · 原图不上传</span>
          </div>
          <div className="batch-actions">
            <button className="btn" type="button" onClick={() => navigate(routePath('home'))}>返回地图</button>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => {
                if (!pending.length) {
                  navigate(routePath('home'));
                  return;
                }
                const n = confirmCandidates();
                notify(`已确认 ${n} 段候选，可以前往我的地图查看`);
              }}
            >
              {pending.length ? '全部确认' : '前往我的地图'}
            </button>
          </div>
        </div>
      </div>

      <Modal
        open={Boolean(mergeSource)}
        title="合并候选"
        subtitle="把两段照片合成同一趟旅行"
        onClose={() => setMergeSource(null)}
        footer={
          <>
            <span className="foot-note">合并只在本地重排，不移动文件</span>
            <div className="modal-actions">
              <button className="btn" type="button" onClick={() => setMergeSource(null)}>取消</button>
              <button className="btn btn-primary" type="button" onClick={doMerge}>合并为 1 趟</button>
            </div>
          </>
        }
      >
        {mergeSource && (
          <>
            <p className="modal-lead">
              将「{mergeSource.cityNames.join(' / ')}」（{fmtDate(mergeSource.startAt)} ~ {fmtDate(mergeSource.endAt)} · {mergeSource.photoIds.length} 张）与：
            </p>
            <div className="merge-list">
              {pending
                .filter((c) => c.id !== mergeSource.id)
                .map((c) => (
                  <label className="merge-option" key={c.id}>
                    <input
                      type="radio"
                      name="mergeTarget"
                      checked={mergeTarget === c.id}
                      onChange={() => setMergeTarget(c.id)}
                    />
                    <PhotoThumb className="merge-cover photo" thumb={data.photos[c.photoIds[0]]?.thumb} label="封面" caption={c.cityNames[0]} />
                    <span className="merge-text">
                      <b>{c.cityNames.join(' / ')}</b>
                      <small>{fmtDate(c.startAt)} ~ {fmtDate(c.endAt)} · {c.photoIds.length} 张照片</small>
                    </span>
                  </label>
                ))}
            </div>
            <p className="modal-hint">合并后时间范围取并集，城市序列去重，照片数相加；原始照片不变，仍可再次拆分。</p>
          </>
        )}
      </Modal>

      <Modal
        open={Boolean(splitTarget)}
        title="拆分候选"
        subtitle="在行程中间按天切开"
        onClose={() => setSplitTarget(null)}
        footer={
          <>
            <span className="foot-note">按所选日期 00:00 切分</span>
            <div className="modal-actions">
              <button className="btn" type="button" onClick={() => setSplitTarget(null)}>取消</button>
              <button className="btn btn-primary" type="button" onClick={doSplit}>确认拆分</button>
            </div>
          </>
        }
      >
        {splitTarget && (
          <>
            <p className="modal-lead">
              将「{splitTarget.cityNames.join(' / ')}」在 <b className="mono">{splitDate}</b> 之后拆成两段：
            </p>
            <div className="split-preview">
              {(() => {
                const cut = new Date(`${splitDate}T00:00:00`).getTime();
                const left = data.candidates.find((c) => c.id === splitTarget.id)?.photoIds.filter((id) => (data.photos[id]?.takenAt ?? 0) < cut).length ?? 0;
                const right = splitTarget.photoIds.length - left;
                return (
                  <>
                    <div className="split-seg">
                      <span className="seg-tag">A</span>
                      <div><b>前半段</b><small className="mono">{fmtDate(splitTarget.startAt)} ~ {fmtDate(cut - 1)}</small><small>{left} 张照片</small></div>
                    </div>
                    <div className="split-seg">
                      <span className="seg-tag">B</span>
                      <div><b>后半段</b><small className="mono">{fmtDate(cut)} ~ {fmtDate(splitTarget.endAt)}</small><small>{right} 张照片</small></div>
                    </div>
                  </>
                );
              })()}
            </div>
            <label className="field-line">
              <span>拆分日期</span>
              <select className="fill-place" value={splitDate} onChange={(e) => setSplitDate(e.target.value)}>
                {splitDays.slice(1).map((d) => (
                  <option key={d} value={fmtDate(d)}>{fmtDate(d)}（{fmtMonthDay(d)}）</option>
                ))}
              </select>
            </label>
            <p className="modal-hint">拆分日期与站点归属可在生成后继续调整；无定位照片会按时间落在对应的那一段。</p>
          </>
        )}
      </Modal>
    </section>
  );
}
