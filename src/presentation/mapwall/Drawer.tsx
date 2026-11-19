import { RepairPhoto, ImportedPhotoPreview } from "./RepairPhotos";
import {
  ManualLocationForm,
  type ManualLocationInput,
} from "./ManualLocationForm";
import { useState } from "react";
import type { Candidate } from "../../domain/candidate/candidate";
import type {
  ImportBatch,
  ImportIssue,
} from "../../domain/import/import-issue";
import type { LocationSuggestion } from "../../domain/services/fill-locations";
import { ISSUE_LABELS } from "../../domain/import/import-issue";
import type { Photo } from "../../domain/photo/photo";
import type {
  ImportProgress,
  ImportSummary,
} from "../../application/import-photos";
import { fmtDate, fmtLocalDate, fmtMonthDay } from "../format";
import { droppedPhotos, splitBoundaries } from "./import-selection";

export type DrawerTab = "import" | "candidates" | "fill" | "progress";

const REASON_LABELS: Record<string, string> = {
  "time-gap": "时间间隔",
  "far-place": "远距离跳变",
  "max-days": "单段最长天数",
  manual: "初始分段",
};

const BATCH_LABELS: Record<string, string> = {
  importing: "导入中",
  completed: "文件已处理",
  "needs-attention": "需要处理",
  cancelled: "已取消",
  failed: "失败",
};

function candidateCityNames(candidate: Candidate): string {
  return (
    candidate.cityRefs
      .map((city) => city.name)
      .slice(0, 2)
      .join(" · ") || "未识别地点"
  );
}

function candidateRange(
  candidate: Candidate,
  photos: ReadonlyMap<string, Photo>,
): string {
  const members = candidate.photoIds
    .map((id) => photos.get(id))
    .filter((photo): photo is Photo => photo !== undefined)
    .sort((a, b) => a.capturedAt - b.capturedAt);
  const first = members[0],
    last = members.at(-1);
  if (first && last)
    return `${fmtLocalDate(first.capturedAt, first.captureOffsetMinutes)} → ${fmtLocalDate(last.capturedAt, last.captureOffsetMinutes)}`;
  return `${fmtDate(candidate.timeRange.start)} → ${fmtMonthDay(candidate.timeRange.end - 1)}`;
}

export interface DrawerProps {
  readonly open: boolean;
  readonly tab: DrawerTab;
  readonly onTab: (tab: DrawerTab) => void;
  readonly onClose: () => void;
  readonly candidates: readonly Candidate[];
  readonly batches: readonly ImportBatch[];
  readonly issues: readonly ImportIssue[];
  readonly suggestions: readonly LocationSuggestion[];
  readonly photosById: ReadonlyMap<string, Photo>;
  readonly onImportFiles: (
    files: readonly File[],
    onProgress: (progress: ImportProgress) => void,
  ) => Promise<ImportSummary>;
  readonly onConfirmCandidate: (id: string) => Promise<void>;
  readonly onIgnoreCandidate: (id: string) => Promise<void>;
  readonly onMergeCandidates: (first: string, second: string) => Promise<void>;
  readonly onSplitCandidate: (id: string, at: number) => Promise<void>;
  readonly onThumbnail?: (id: string) => Promise<Blob | null>;
  readonly onRetryPhoto?: (id: string, file?: File) => Promise<void>;
  readonly onPhotoTime?: (id: string, at: number | null) => Promise<void>;
  readonly onSetPhotoLocations?: (
    ids: readonly string[],
    input: ManualLocationInput,
  ) => Promise<void>;
  readonly onApplySuggestions: (photoIds: readonly string[]) => Promise<void>;
}

export function Drawer(props: DrawerProps) {
  const [manualIds, setManualIds] = useState<readonly string[]>([]);
  const [selection, setSelection] = useState<readonly File[]>([]);
  const [splitSelection, setSplitSelection] = useState<{
    id: string;
    index: number;
  } | null>(null);
  const [selectedCandidates, setSelectedCandidates] = useState<
    readonly string[]
  >([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<
    readonly string[]
  >([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [fileLog, setFileLog] = useState<readonly string[]>([]);

  if (!props.open) return null;
  const pending = props.candidates.filter(
    (candidate) => candidate.status === "pending",
  );
  const missingPhotos = [...props.photosById.values()].filter(
    (p) => !p.ignored && p.geo === null,
  );
  const fillCount = missingPhotos.length;
  const repairPhotos = [...props.photosById.values()].filter(
    (p) =>
      !p.ignored &&
      (!p.thumbRef ||
        p.capturedAtSource === "missing" ||
        p.capturedAtSource === "file-mtime"),
  );
  const problemGroups = new Map<string, typeof props.issues>();
  for (const issue of props.issues) {
    const key = issue.batchId + ":" + issue.fileName;
    const found = [...props.photosById.values()].find(
      (p) => p.importBatchId === issue.batchId && p.fileName === issue.fileName,
    );
    if (
      issue.code === "duplicate" ||
      (found &&
        ((issue.code === "thumbnail-failed" && found.thumbRef) ||
          (issue.code === "no-timestamp" &&
            found.capturedAtSource === "manual")))
    )
      continue;
    problemGroups.set(key, [...(problemGroups.get(key) ?? []), issue]);
  }

  const toggle = (current: readonly string[], id: string): readonly string[] =>
    current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id];

  const runImport = async (files: readonly File[] | null) => {
    if (!files || files.length === 0) return;
    setImporting(true);
    setFileLog([]);
    setProgress({ done: 0, total: files.length, fileName: "" });
    setImportResult(null);
    try {
      const summary = await props.onImportFiles(files, (next) => {
        setProgress(next);
        if (!next.fileName) return;
        setFileLog((current) =>
          current.includes(next.fileName)
            ? current
            : [...current, next.fileName].slice(-8),
        );
      });
      setSelection([]);
      setImportResult(
        `已保存 ${summary.imported} 条记录 · 可显示照片 ${summary.ready ?? summary.imported} 张 · 需处理 ${summary.needsRepair ?? 0} 张 · 修复 ${summary.repaired ?? 0} 张 · 重复跳过 ${summary.duplicates} · 失败 ${summary.failed} · 待确认 ${summary.candidateCount} 段`,
      );
    } catch (error) {
      setImportResult(error instanceof Error ? error.message : "导入失败");
    } finally {
      setImporting(false);
      setProgress(null);
    }
  };

  const fillGroups = new Map<string, typeof props.suggestions>();
  for (const suggestion of props.suggestions) {
    const photo = props.photosById.get(suggestion.photoId);
    const day = photo
      ? fmtLocalDate(photo.capturedAt, photo.captureOffsetMinutes)
      : "未知日期";
    const list = fillGroups.get(day) ?? [];
    fillGroups.set(day, [...list, suggestion]);
  }

  const exportIssues = () => {
    if (props.issues.length === 0) return;
    const payload = props.issues.map((issue) => ({
      file: issue.fileName,
      code: issue.code,
      label: ISSUE_LABELS[issue.code] ?? issue.code,
      detail: issue.message,
    }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `travel-frog-import-issues-${fmtDate(Date.now())}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <aside className="drawer" aria-label="整理">
      <header className="drawer-head">
        <div>
          <h2>整理</h2>
          <p>照片留在本机，整理不离开这面墙。</p>
        </div>
        <button
          className="icon-btn"
          type="button"
          aria-label="关闭整理"
          onClick={props.onClose}
        >
          ×
        </button>
      </header>
      <div className="tabs" role="tablist" aria-label="整理分区">
        <button
          type="button"
          role="tab"
          aria-selected={props.tab === "import"}
          className={props.tab === "import" ? "is-on" : ""}
          onClick={() => props.onTab("import")}
        >
          导入
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={props.tab === "candidates"}
          className={props.tab === "candidates" ? "is-on" : ""}
          onClick={() => props.onTab("candidates")}
        >
          候选{" "}
          {pending.length > 0 ? <i className="pill">{pending.length}</i> : null}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={props.tab === "fill"}
          className={props.tab === "fill" ? "is-on" : ""}
          onClick={() => props.onTab("fill")}
        >
          补位置 {fillCount > 0 ? <i className="pill">{fillCount}</i> : null}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={props.tab === "progress"}
          className={props.tab === "progress" ? "is-on" : ""}
          onClick={() => props.onTab("progress")}
        >
          进度
        </button>
      </div>
      <input
        id="wall-file-input"
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.heic,.heif"
        multiple
        hidden
        onChange={(event) => {
          setSelection(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
      <input
        id="wall-folder-input"
        type="file"
        multiple
        hidden
        {...{ webkitdirectory: "" }}
        onChange={(e) => {
          setSelection(Array.from(e.currentTarget.files ?? []));
          e.currentTarget.value = "";
        }}
      />
      <div className="drawer-body">
        {props.tab === "import" ? (
          <div className="panel">
            <div
              className="dropzone"
              role="button"
              tabIndex={0}
              onClick={() => {
                if (!importing)
                  document.getElementById("wall-file-input")?.click();
              }}
              onKeyDown={(event) => {
                if (!importing && event.key === "Enter")
                  document.getElementById("wall-file-input")?.click();
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (importing) return;
                void droppedPhotos(event.dataTransfer)
                  .then(setSelection)
                  .catch((error) =>
                    setImportResult(
                      error instanceof Error ? error.message : "无法读取文件夹",
                    ),
                  );
              }}
            >
              <span className="dz-icon">
                <svg
                  viewBox="0 0 24 24"
                  width="26"
                  height="26"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                >
                  <path d="M12 16V5M7 10l5-5 5 5" />
                  <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
                </svg>
              </span>
              <strong>把照片拖到这里</strong>
              <span>或点击选择文件 · JPG、PNG、WebP、HEIC</span>
            </div>
            <p className="note">
              JPG、PNG、WebP；HEIC/HEIF
              预览取决于浏览器解码能力，问题文件会单独保留。
            </p>
            <button
              type="button"
              className="btn ghost"
              disabled={importing}
              onClick={() =>
                document.getElementById("wall-folder-input")?.click()
              }
            >
              选择文件夹（含子文件夹）
            </button>
            {selection.length > 0 && (
              <section className="card import-preview" aria-label="本次选择">
                <h3>本次选择 · {selection.length} 个文件</h3>
                <p className="note">
                  {(
                    selection.reduce((sum, file) => sum + file.size, 0) /
                    1024 /
                    1024
                  ).toFixed(1)}{" "}
                  MB · 按时间和位置生成候选，确认前不会成为旅行。
                </p>
                <ul>
                  {selection.map((file, index) => (
                    <li key={index}>
                      <span>{file.webkitRelativePath || file.name}</span>
                      <small>
                        {/\.(heic|heif)$/i.test(file.name)
                          ? "需浏览器解码"
                          : file.type.startsWith("image/")
                            ? "可解析"
                            : "格式待检查"}{" "}
                        · {(file.size / 1024).toFixed(0)} KB
                      </small>
                    </li>
                  ))}
                </ul>
                <button
                  className="btn primary"
                  disabled={importing}
                  type="button"
                  onClick={() => void runImport(selection)}
                >
                  导入 {selection.length} 个文件
                </button>{" "}
                <button
                  className="btn ghost"
                  disabled={importing}
                  type="button"
                  onClick={() => setSelection([])}
                >
                  取消选择
                </button>
              </section>
            )}
            {progress ? (
              <div className="card">
                <div className="panel-title">
                  <h3>
                    {
                      (
                        {
                          metadata: "读取时间与位置",
                          preview: "生成照片预览",
                          candidates: "整理候选旅行",
                          saving: "保存到本机",
                          completed: "导入完成",
                        } as const
                      )[progress.stage ?? "metadata"]
                    }
                  </h3>
                  <span>
                    {progress.done} / {progress.total}
                  </span>
                </div>
                <div className="bar">
                  <i
                    style={{
                      width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <p className="note">{progress.fileName}</p>
              </div>
            ) : null}
            {fileLog.length > 0 ? (
              <ul className="file-log">
                {fileLog.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            ) : null}
            {importResult ? (
              <>
                <p className="note" role="status">
                  {importResult}
                </p>
                <button
                  type="button"
                  className="btn primary"
                  onClick={() =>
                    props.onTab(repairPhotos.length ? "progress" : "candidates")
                  }
                >
                  {repairPhotos.length
                    ? "下一步：修复照片或补拍摄时间"
                    : "下一步：确认照片并在地图查看"}
                </button>
              </>
            ) : null}
            <p className="note">
              照片只在本机解析。成功后保存预览；解码失败时最多保留25MB原文件供本机重试。导入完成后先生成候选，确认后才成为旅行。
            </p>
          </div>
        ) : null}

        {props.tab === "candidates" ? (
          <div className="panel">
            <div className="panel-title">
              <h3>待确认</h3>
              <span>{pending.length} 段</span>
            </div>
            {pending.length === 0 ? (
              <p className="note">
                没有待确认的候选。导入照片后，这里会按时间与位置切分。
              </p>
            ) : null}
            {pending.length > 1 ? (
              <details>
                <summary>高级整理：合并候选</summary>
                <div className="merge-bar">
                  <span className="merge-icon">⇄</span>
                  <span>
                    勾选两张候选可以合并；拖动分界线预览拆分，确认后才写入。
                  </span>
                  <button
                    className="btn ghost"
                    type="button"
                    disabled={selectedCandidates.length !== 2 || importing}
                    onClick={async () => {
                      const [first, second] = selectedCandidates;
                      if (!first || !second) return;
                      setSelectedCandidates([]);
                      await props.onMergeCandidates(first, second);
                    }}
                  >
                    合并所选
                  </button>
                </div>
              </details>
            ) : null}
            {pending.map((candidate) => {
              const bars = [
                "on",
                "on",
                "on",
                candidate.confidence === "high" ? "on" : "gap",
                "on",
                "on",
              ];
              const checked = selectedCandidates.includes(candidate.id);
              const boundaries = splitBoundaries(
                candidate.photoIds,
                props.photosById,
              );
              const splitting = splitSelection?.id === candidate.id;
              const splitAt =
                boundaries[
                  Math.min(splitSelection?.index ?? 0, boundaries.length - 1)
                ];
              const leftCount = candidate.photoIds.filter(
                (id) =>
                  (props.photosById.get(id)?.capturedAt ?? Infinity) <
                  (splitAt ?? 0),
              ).length;
              return (
                <div className="card candidate" key={candidate.id}>
                  <div className="candidate-top">
                    <div>
                      <h4>{candidateCityNames(candidate)}</h4>
                      <p className="sub">
                        {candidateRange(candidate, props.photosById)} ·{" "}
                        {candidate.photoIds.length} 张
                      </p>
                    </div>
                    <span className={`badge ${candidate.confidence}`}>
                      {candidate.confidence === "high" ? "高置信" : "低置信"}
                    </span>
                  </div>
                  <div className="candidate-previews">
                    {candidate.photoIds.slice(0, 6).map((id) => {
                      const photo = props.photosById.get(id);
                      return photo ? (
                        <ImportedPhotoPreview
                          key={id}
                          photo={photo}
                          load={props.onThumbnail}
                        />
                      ) : null;
                    })}
                  </div>
                  <div className="timeline">
                    {bars.map((bar, index) => (
                      <i key={index} className={bar} />
                    ))}
                  </div>
                  <div className="reasons">
                    {candidate.splitReasons.map((reason) => (
                      <span className="chip" key={reason}>
                        {REASON_LABELS[reason] ?? reason}
                      </span>
                    ))}
                    {candidate.locationMissingCount > 0 ? (
                      <span className="chip">
                        {candidate.locationMissingCount} 张缺定位
                      </span>
                    ) : null}
                  </div>
                  <div className="cand-actions">
                    <button
                      className="btn primary"
                      type="button"
                      onClick={() => {
                        if (
                          candidate.photoIds.some(
                            (id) =>
                              !props.photosById.get(id)?.thumbRef ||
                              props.photosById.get(id)?.capturedAtSource ===
                                "missing",
                          )
                        ) {
                          props.onTab("progress");
                        } else if (candidate.locationMissingCount > 0) {
                          setManualIds(
                            candidate.photoIds.filter(
                              (id) => props.photosById.get(id)?.geo === null,
                            ),
                          );
                          props.onTab("fill");
                        } else void props.onConfirmCandidate(candidate.id);
                      }}
                    >
                      {candidate.photoIds.some(
                        (id) => !props.photosById.get(id)?.thumbRef,
                      )
                        ? "先修复照片预览"
                        : candidate.locationMissingCount > 0
                          ? "先补位置，再上地图"
                          : "确认并在地图查看"}
                    </button>
                    {candidate.locationMissingCount > 0 && (
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={() =>
                          void props.onConfirmCandidate(candidate.id)
                        }
                      >
                        先存入档案（暂不上图）
                      </button>
                    )}
                    <button
                      className="btn ghost"
                      type="button"
                      onClick={() => void props.onIgnoreCandidate(candidate.id)}
                    >
                      忽略
                    </button>
                    <button
                      className="btn ghost"
                      type="button"
                      onClick={() =>
                        setSplitSelection({ id: candidate.id, index: 0 })
                      }
                    >
                      拆分
                    </button>
                    <label className="chip">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSelectedCandidates((current) =>
                            toggle(current, candidate.id),
                          )
                        }
                      />{" "}
                      选择
                    </label>
                  </div>
                  {splitting && (
                    <div className="split-preview">
                      {splitAt === undefined ? (
                        <p>这些照片的拍摄时间相同，暂时无法按时间拆分。</p>
                      ) : (
                        <>
                          <label>
                            拆分分界线
                            <input
                              type="range"
                              aria-label="拆分分界线"
                              min={0}
                              max={Math.max(0, boundaries.length - 1)}
                              value={Math.min(
                                splitSelection.index,
                                boundaries.length - 1,
                              )}
                              onChange={(e) =>
                                setSplitSelection({
                                  id: candidate.id,
                                  index: Number(e.target.value),
                                })
                              }
                            />
                          </label>
                          <p>
                            {new Date(splitAt).toLocaleString()} 之前{" "}
                            {leftCount} 张 · 之后{" "}
                            {candidate.photoIds.length - leftCount} 张
                          </p>
                          <button
                            className="btn primary"
                            type="button"
                            onClick={async () => {
                              await props.onSplitCandidate(
                                candidate.id,
                                splitAt,
                              );
                              setSplitSelection(null);
                            }}
                          >
                            确认拆为两段
                          </button>
                        </>
                      )}
                      <button
                        className="btn ghost"
                        type="button"
                        onClick={() => setSplitSelection(null)}
                      >
                        取消拆分
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            <p className="note">
              有坐标的照片确认后才上地图；缺位置的照片可先补位置，或暂存档案后再补。
            </p>
          </div>
        ) : null}

        {props.tab === "fill" ? (
          <div className="panel">
            <div className="panel-title">
              <h3>缺定位照片</h3>
              <span>
                {fillCount} 张缺位置 · {props.suggestions.length} 张有建议
              </span>
            </div>
            {fillCount === 0 ? (
              <p className="note">目前没有缺位置的照片。</p>
            ) : (
              <p className="note">
                可以手动指定任意地点；下面的自动建议仅供参考，不会自动写入。
              </p>
            )}
            {manualIds.length > 0 && props.onSetPhotoLocations ? (
              <ManualLocationForm
                key={manualIds.join(",")}
                count={manualIds.length}
                onCancel={() => setManualIds([])}
                onSave={async (input) => {
                  await props.onSetPhotoLocations!(manualIds, input);
                  setManualIds([]);
                  props.onTab("candidates");
                }}
              />
            ) : null}
            {missingPhotos.map((photo) => (
              <div className="card fill-row" key={photo.id}>
                <span>
                  {photo.fileName} · 缺位置
                  {props.suggestions.some((s) => s.photoId === photo.id)
                    ? " · 有建议"
                    : " · 无自动建议"}
                </span>
                <button
                  className="btn primary"
                  type="button"
                  onClick={() => setManualIds([photo.id])}
                >
                  手动指定位置
                </button>
              </div>
            ))}
            {props.suggestions.length > 0 ? (
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <button
                  className="btn primary"
                  type="button"
                  disabled={selectedSuggestions.length === 0}
                  onClick={async () => {
                    const ids = selectedSuggestions;
                    setSelectedSuggestions([]);
                    await props.onApplySuggestions(ids);
                  }}
                >
                  套用所选 {selectedSuggestions.length} 张
                </button>
                <button
                  className="btn ghost"
                  type="button"
                  onClick={async () => {
                    await props.onApplySuggestions(
                      props.suggestions.map((item) => item.photoId),
                    );
                  }}
                >
                  全部套用
                </button>
              </div>
            ) : null}
            <div className="fill-groups">
              {Array.from(fillGroups.entries()).map(([day, suggestions]) => (
                <div className="card" key={day}>
                  <div className="panel-title">
                    <h3>{day}</h3>
                    <button
                      className="btn ghost"
                      type="button"
                      onClick={async () => {
                        const ids = suggestions.map((item) => item.photoId);
                        setSelectedSuggestions((current) =>
                          current.filter((id) => !ids.includes(id)),
                        );
                        await props.onApplySuggestions(ids);
                      }}
                    >
                      按天套用 {suggestions.length} 张
                    </button>
                  </div>
                  {suggestions.map((suggestion) => {
                    const photo = props.photosById.get(suggestion.photoId);
                    const checked = selectedSuggestions.includes(
                      suggestion.photoId,
                    );
                    return (
                      <div className="fill-row" key={suggestion.photoId}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setSelectedSuggestions((current) =>
                              toggle(current, suggestion.photoId),
                            )
                          }
                        />
                        <span className="meta">
                          <strong>
                            {photo?.fileName ?? suggestion.photoId}
                          </strong>
                          <span>
                            → {suggestion.cityRef.name} ·{" "}
                            {suggestion.reason === "same-day-gps"
                              ? "同日 GPS"
                              : "时间最近"}{" "}
                            ·{" "}
                            {suggestion.confidence === "high"
                              ? "高"
                              : suggestion.confidence === "medium"
                                ? "中"
                                : "低"}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
              <p className="note">
                候选来自本机照片的同日位置，不会自动写入。套用后照片会出现在地图上，并标记为「推断」。
              </p>
            </div>
          </div>
        ) : null}

        {props.tab === "progress" ? (
          <div className="panel">
            {props.onRetryPhoto &&
              props.onPhotoTime &&
              repairPhotos.map((photo) => (
                <RepairPhoto
                  key={photo.id}
                  photo={photo}
                  load={props.onThumbnail}
                  onRetry={props.onRetryPhoto!}
                  onTime={props.onPhotoTime!}
                />
              ))}
            <div className="panel-title">
              <h3>最近的导入</h3>
              <span>{props.batches.length} 批</span>
            </div>
            <div className="card">
              {props.batches.length === 0 ? (
                <p className="note">还没有导入记录。</p>
              ) : null}
              {props.batches.map((batch) => {
                const members = [...props.photosById.values()].filter(
                  (p) => p.importBatchId === batch.id,
                );
                const needs = members.filter(
                  (p) =>
                    !p.thumbRef ||
                    p.capturedAtSource === "missing" ||
                    p.capturedAtSource === "file-mtime",
                ).length;
                const state =
                  needs > 0
                    ? "needs-attention"
                    : batch.status === "needs-attention"
                      ? "completed"
                      : batch.status;
                return (
                  <div className="progress-row" key={batch.id}>
                    <span
                      className={`pstate ${state === "completed" ? "done" : state === "failed" ? "error" : "running"}`}
                    >
                      {state === "completed"
                        ? "✓"
                        : state === "failed"
                          ? "!"
                          : "·"}
                    </span>
                    <span className="plabel">
                      <strong>{BATCH_LABELS[state] ?? state}</strong>
                      <span>
                        {batch.sourceFileCount} 个文件 · {batch.photoCount}{" "}
                        张照片 · {batch.candidateCount} 段候选
                      </span>
                    </span>
                    {batch.issueCount > 0 ? (
                      <span className="hint">历史提示 {batch.issueCount} 条</span>
                    ) : null}
                    {state === "failed" ? (
                      <button
                        className="btn ghost"
                        type="button"
                        onClick={() => {
                          if (!importing)
                            document.getElementById("wall-file-input")?.click();
                        }}
                      >
                        重新选择文件重试
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="card">
              <div className="panel-title">
                <h3>问题文件</h3>
                <span>{problemGroups.size} 个文件</span>
              </div>
              {props.issues.length > 0 ? (
                <button
                  className="btn ghost"
                  type="button"
                  onClick={exportIssues}
                >
                  导出问题清单
                </button>
              ) : null}
              {problemGroups.size === 0 ? (
                <p className="note">没有需要处理的问题文件。</p>
              ) : null}
              {[...problemGroups.entries()].map(([key, issues]) => (
                <div className="file-row" key={key}>
                  <span className="name">{issues[0]?.fileName}</span>
                  <span className="issue">
                    {[...new Set(issues.map((i) => ISSUE_LABELS[i.code]))].join(
                      " · ",
                    )}
                  </span>
                </div>
              ))}
              <p className="note" style={{ marginTop: 8 }}>
                问题文件不会静默丢弃：可重试，或导出问题清单。
              </p>
            </div>
            <p className="note">
              存档写入是事务性的；失败会保留上一次的完整快照。
            </p>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
