import { RepairPhoto, ImportedPhotoPreview } from "./RepairPhotos";
import {
  ManualLocationForm,
  type ManualLocationInput,
} from "./ManualLocationForm";
import { useLayoutEffect, useRef, useState } from "react";
import "./photo-location-review.css";
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
import { AppError } from "../../application/ports";
import { fmtDate, fmtLocalDate, fmtMonthDay } from "../format";
import {
  droppedPhotos,
  mergeSelection,
  nextStepForImport,
  removeSelection,
  splitBoundaries,
} from "./import-selection";
import { ImportSelection } from "./ImportSelection";

export type DrawerTab = "import" | "candidates" | "fill" | "progress";

type ImportOutcome =
  | { readonly kind: "summary"; readonly summary: ImportSummary }
  | { readonly kind: "cancelled" }
  | { readonly kind: "error"; readonly message: string };

const NO_FILES: readonly File[] = [];
const ignoreSelection = (_files: readonly File[]) => {};

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
  readonly selection?: readonly File[];
  readonly onSelectionChange?: (files: readonly File[]) => void;
  readonly onImportingChange?: (importing: boolean) => void;
  readonly onImportFiles: (
    files: readonly File[],
    onProgress: (progress: ImportProgress) => void,
    signal?: AbortSignal,
  ) => Promise<ImportSummary>;
  readonly onConfirmCandidate: (id: string) => Promise<void>;
  readonly onIgnoreCandidate: (id: string) => Promise<void>;
  readonly onMergeCandidates: (first: string, second: string) => Promise<void>;
  readonly onSplitCandidate: (id: string, at: number) => Promise<void>;
  readonly onThumbnail?: (id: string) => Promise<Blob | null>;
  readonly onRetryPhoto?: (id: string, file?: File) => Promise<void>;
  readonly onPhotoTime?: (id: string, at: number | null) => Promise<void>;
  readonly onPickPhotoLocation?: (
    ids: readonly string[],
    returnTab: DrawerTab,
  ) => void;
  readonly onOpenLocationInbox?: (candidateId: string | null) => void;
  readonly onSetPhotoLocations?: (
    ids: readonly string[],
    input: ManualLocationInput,
  ) => Promise<void>;
  readonly onApplySuggestions: (photoIds: readonly string[]) => Promise<void>;
}

export function Drawer(props: DrawerProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const savedScroll = useRef({ tab: props.tab, top: 0 });
  useLayoutEffect(() => {
    if (props.open && bodyRef.current)
      bodyRef.current.scrollTop =
        savedScroll.current.tab === props.tab ? savedScroll.current.top : 0;
  }, [props.open, props.tab]);
  const [locationBusy, setLocationBusy] = useState(false),
    [locationError, setLocationError] = useState(""),
    [locationMessage, setLocationMessage] = useState("");
  const applyLocationSuggestions = async (ids: readonly string[]) => {
    if (!ids.length || locationBusy) return;
    setLocationBusy(true);
    setLocationError("");
    setLocationMessage("");
    try {
      await props.onApplySuggestions(ids);
      setSelectedSuggestions((current) =>
        current.filter((id) => !ids.includes(id)),
      );
      setLocationMessage("地点建议已应用。");
    } catch (error) {
      setLocationError(
        error instanceof Error ? error.message : "地点建议没有保存，请重试",
      );
    } finally {
      setLocationBusy(false);
    }
  };
  const [manualIds, setManualIds] = useState<readonly string[]>([]);
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
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const [fileLog, setFileLog] = useState<readonly string[]>([]);
  const [cancelling, setCancelling] = useState(false);
  const [readingDrop, setReadingDrop] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const selection = props.selection ?? NO_FILES;
  const changeSelection = props.onSelectionChange ?? ignoreSelection;

  if (!props.open) return null;
  const pending = props.candidates.filter(
    (candidate) => candidate.status === "pending",
  );
  const missingPhotos = [...props.photosById.values()].filter(
    (p) => !p.ignored && p.geo === null,
  );
  const fillCount = missingPhotos.length;
  const missingIds = new Set<string>(missingPhotos.map((p) => p.id));
  const locationSuggestions = new Map(
    props.suggestions
      .filter((s) => missingIds.has(s.photoId))
      .map((s) => [s.photoId, s]),
  );
  const suggestedIds = [...locationSuggestions.keys()];
  const chosenIds = selectedSuggestions.filter((id) =>
    locationSuggestions.has(id),
  );
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

  const runImport = async () => {
    const files = selection;
    if (files.length === 0 || importing) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setImporting(true);
    props.onImportingChange?.(true);
    setCancelling(false);
    setFileLog([]);
    setProgress({ done: 0, total: files.length, fileName: "" });
    setOutcome(null);
    try {
      const summary = await props.onImportFiles(
        files,
        (next) => {
          setProgress(next);
          if (!next.fileName) return;
          setFileLog((current) =>
            current.includes(next.fileName)
              ? current
              : [...current, next.fileName].slice(-8),
          );
        },
        controller.signal,
      );
      changeSelection([]);
      setOutcome({ kind: "summary", summary });
    } catch (error) {
      if (error instanceof AppError && error.code === "IMPORT_CANCELLED") {
        setOutcome({ kind: "cancelled" });
      } else {
        setOutcome({
          kind: "error",
          message: error instanceof Error ? error.message : "导入失败",
        });
      }
    } finally {
      setImporting(false);
      props.onImportingChange?.(false);
      abortRef.current = null;
      setCancelling(false);
      setProgress(null);
    }
  };

  const cancelImport = () => {
    if (!importing) return;
    setCancelling(true);
    abortRef.current?.abort();
  };

  const appendFiles = (files: readonly File[]) => {
    if (files.length === 0) return;
    changeSelection(mergeSelection(selection, files));
    setOutcome(null);
  };

  const outcomeSummary =
    outcome?.kind === "summary" ? outcome.summary : null;
  const nextStep = outcomeSummary ? nextStepForImport(outcomeSummary) : null;
  const importedIds = new Set<string>(
    outcomeSummary
      ? [...props.photosById.values()]
          .filter((photo) => photo.importBatchId === outcomeSummary.batchId)
          .map((photo) => photo.id)
      : [],
  );
  const importedSuggestionCount = props.suggestions.filter((item) =>
    importedIds.has(item.photoId),
  ).length;
  const nextLabel =
    nextStep === "repair"
      ? "下一步：处理问题照片"
      : nextStep === "location"
        ? `给 ${outcomeSummary?.withoutLocation ?? 0} 张照片标记位置`
        : nextStep === "candidates"
          ? "下一步：确认候选旅行"
          : "完成";
  const goNext = () => {
    if (nextStep === "repair") {
      setOutcome(null);
      props.onTab("progress");
      return;
    }
    if (nextStep === "location") {
      setOutcome(null);
      props.onOpenLocationInbox?.(null);
      return;
    }
    if (nextStep === "candidates") {
      setOutcome(null);
      props.onTab("candidates");
      return;
    }
    setOutcome(null);
  };

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
    <aside className="drawer" aria-label="管理照片">
      <header className="drawer-head">
        <div>
          <h2>管理照片</h2>
          <p>照片留在本机，整理不离开这面墙。</p>
        </div>
        <button
          className="icon-btn"
          type="button"
          aria-label="关闭管理照片"
          onClick={props.onClose}
        >
          ×
        </button>
      </header>
      {fillCount > 0 && (
        <button
          type="button"
          className="photo-location-reminder"
          onClick={() => props.onTab("fill")}
        >
          {fillCount} 张照片待补位置
        </button>
      )}
      <div className="tabs" role="tablist" aria-label="照片管理分区">
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
          appendFiles(Array.from(event.target.files ?? []));
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
          appendFiles(Array.from(e.currentTarget.files ?? []));
          e.currentTarget.value = "";
        }}
      />
      <div
        className="drawer-body"
        ref={bodyRef}
        onScroll={(e) => {
          savedScroll.current = {
            tab: props.tab,
            top: e.currentTarget.scrollTop,
          };
        }}
      >
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
                setReadingDrop(true);
                void droppedPhotos(event.dataTransfer)
                  .then((files) => appendFiles(files))
                  .catch((error) =>
                    setOutcome({
                      kind: "error",
                      message:
                        error instanceof Error ? error.message : "无法读取文件夹",
                    }),
                  )
                  .finally(() => setReadingDrop(false));
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
            <ImportSelection
              files={selection}
              importing={importing}
              onImport={() => void runImport()}
              onAdd={() =>
                document.getElementById("wall-file-input")?.click()
              }
              onClear={() => {
                changeSelection([]);
                setOutcome(null);
              }}
              onRemove={(key) =>
                changeSelection(removeSelection(selection, key))
              }
            />
            {readingDrop ? (
              <p className="note" role="status">
                正在读取文件夹…
              </p>
            ) : null}
            {progress ? (
              <div className="card import-progress">
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
                    已完成 {progress.done} / {progress.total}
                  </span>
                </div>
                <div className={`bar${importing ? " is-active" : ""}`}>
                  <i
                    style={{
                      width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <p className="note">
                  {progress.fileName
                    ? `正在处理：${progress.fileName}`
                    : "保存到本机…"}
                </p>
                <button
                  className="btn ghost"
                  type="button"
                  disabled={cancelling}
                  onClick={cancelImport}
                >
                  {cancelling ? "正在取消…" : "取消导入"}
                </button>
              </div>
            ) : null}
            {outcome ? (
              <section
                className={`card import-result is-${outcome.kind}`}
                aria-label="导入结果"
              >
                {outcome.kind === "summary" ? (
                  <>
                    <div className="panel-title">
                      <h3>导入完成</h3>
                      <span>{outcome.summary.imported} 张新增</span>
                    </div>
                    <p className="import-saved-line" role="status">
                      已保存 {outcome.summary.imported} 条记录 · 可显示{" "}
                      {outcome.summary.ready ?? outcome.summary.imported} 张
                    </p>
                    <div className="import-result-grid">
                      <div>
                        <strong>{outcome.summary.imported}</strong>
                        <span>新增照片</span>
                      </div>
                      <div>
                        <strong>
                          {outcome.summary.ready ?? outcome.summary.imported}
                        </strong>
                        <span>可直接查看</span>
                      </div>
                      <div>
                        <strong>{outcome.summary.withLocation ?? 0}</strong>
                        <span>已识别位置</span>
                      </div>
                      <div className={(outcome.summary.withoutLocation ?? 0) > 0 ? "is-warn" : ""}>
                        <strong>{outcome.summary.withoutLocation ?? 0}</strong>
                        <span>缺位置</span>
                      </div>
                      <div className={(outcome.summary.missingTime ?? 0) > 0 ? "is-warn" : ""}>
                        <strong>{outcome.summary.missingTime ?? 0}</strong>
                        <span>缺拍摄时间</span>
                      </div>
                      <div>
                        <strong>{outcome.summary.candidateCount}</strong>
                        <span>候选旅行</span>
                      </div>
                      <div>
                        <strong>{outcome.summary.duplicates}</strong>
                        <span>重复跳过</span>
                      </div>
                      {(outcome.summary.repaired ?? 0) > 0 ? (
                        <div>
                          <strong>{outcome.summary.repaired}</strong>
                          <span>修复预览</span>
                        </div>
                      ) : null}
                      {outcome.summary.failed > 0 ? (
                        <div className="is-bad">
                          <strong>{outcome.summary.failed}</strong>
                          <span>失败</span>
                        </div>
                      ) : null}
                    </div>
                    {importedSuggestionCount > 0 &&
                    (outcome.summary.withoutLocation ?? 0) > 0 ? (
                      <p className="note">
                        其中 {importedSuggestionCount} 张有同日位置建议，可在定位工作台一键套用。
                      </p>
                    ) : null}
                    <div className="import-result-actions">
                      <button
                        type="button"
                        className="btn primary"
                        onClick={goNext}
                      >
                        {nextLabel}
                      </button>
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={() => {
                          setOutcome(null);
                          changeSelection([]);
                        }}
                      >
                        继续导入
                      </button>
                    </div>
                  </>
                ) : null}
                {outcome.kind === "cancelled" ? (
                  <>
                    <h3>已取消导入</h3>
                    <p className="note" role="status">
                      本次没有写入任何照片，选择仍然保留，可以重新开始。
                    </p>
                    <div className="import-result-actions">
                      <button
                        type="button"
                        className="btn primary"
                        onClick={() => {
                          setOutcome(null);
                          void runImport();
                        }}
                      >
                        重新导入
                      </button>
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={() => setOutcome(null)}
                      >
                        关闭
                      </button>
                    </div>
                  </>
                ) : null}
                {outcome.kind === "error" ? (
                  <>
                    <h3>导入没有完成</h3>
                    <p role="alert">{outcome.message}</p>
                    {selection.length > 0 ? (
                      <div className="import-result-actions">
                        <button
                          type="button"
                          className="btn primary"
                          onClick={() => {
                            setOutcome(null);
                            void runImport();
                          }}
                        >
                          重试
                        </button>
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => setOutcome(null)}
                        >
                          关闭
                        </button>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </section>
            ) : null}
            {fileLog.length > 0 ? (
              <details className="import-log">
                <summary>本次处理文件（{fileLog.length}）</summary>
                <ul className="file-log">
                  {fileLog.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              </details>
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
                          if (props.onOpenLocationInbox) {
                            props.onOpenLocationInbox(candidate.id);
                          } else {
                            const ids = candidate.photoIds.filter(
                              (id) => props.photosById.get(id)?.geo === null,
                            );
                            if (props.onPickPhotoLocation)
                              props.onPickPhotoLocation(ids, "candidates");
                            else {
                              setManualIds(ids);
                              props.onTab("fill");
                            }
                          }
                        } else void props.onConfirmCandidate(candidate.id);
                      }}
                    >
                      {candidate.photoIds.some(
                        (id) => !props.photosById.get(id)?.thumbRef,
                      )
                        ? "先修复照片预览"
                        : candidate.locationMissingCount > 0
                          ? `补 ${candidate.locationMissingCount} 张位置`
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
          <section className="panel location-review" aria-label="补照片位置">
            <div className="panel-title">
              <h3>待补位置照片</h3>
              <span>
                {fillCount} 张 · {locationSuggestions.size} 张有建议
              </span>
            </div>
            {fillCount === 0 ? (
              <p className="note">目前没有缺位置的照片。</p>
            ) : (
              <p className="location-intro">
                每张照片只需确认一次位置。有建议可直接使用，也可以在地图上重新选。
              </p>
            )}
            {fillCount > 0 && props.onOpenLocationInbox ? (
              <button
                className="btn primary wide"
                type="button"
                onClick={() => props.onOpenLocationInbox?.(null)}
              >
                打开定位工作台 · 缩略图与同日建议
              </button>
            ) : null}
            {suggestedIds.length > 0 && (
              <div className="location-batch" aria-label="批量使用地点建议">
                <label>
                  <input
                    type="checkbox"
                    aria-label={`全选 ${suggestedIds.length} 张有建议的照片`}
                    checked={chosenIds.length === suggestedIds.length}
                    onChange={(e) =>
                      setSelectedSuggestions(
                        e.target.checked ? suggestedIds : [],
                      )
                    }
                  />
                  全选有建议的 {suggestedIds.length} 张
                </label>
                <button
                  type="button"
                  className="btn primary"
                  disabled={chosenIds.length === 0 || locationBusy}
                  onClick={() => void applyLocationSuggestions([...chosenIds])}
                >
                  为所选 {chosenIds.length} 张应用建议
                </button>
                <p>只应用勾选照片的现有建议；没有建议的照片不会被改动。</p>
              </div>
            )}
            {locationError && <p role="alert">{locationError}</p>}
            {locationMessage && <p role="status">{locationMessage}</p>}
            <ul className="location-photo-list" aria-label="待补位置照片列表">
              {missingPhotos.map((photo) => {
                const suggestion = locationSuggestions.get(photo.id);
                const checked = chosenIds.includes(photo.id);
                return (
                  <li
                    className="location-photo-row"
                    data-location-photo={photo.id}
                    key={photo.id}
                  >
                    <div className="location-photo-heading">
                      {suggestion && (
                        <input
                          type="checkbox"
                          aria-label={`选择 ${photo.fileName} 的地点建议`}
                          checked={checked}
                          onChange={() =>
                            setSelectedSuggestions((current) =>
                              toggle(current, photo.id),
                            )
                          }
                        />
                      )}
                      <strong title={photo.fileName}>{photo.fileName}</strong>
                    </div>
                    <div className="location-photo-content">
                      <ImportedPhotoPreview
                        photo={photo}
                        load={props.onThumbnail}
                      />
                      <div className="location-photo-context">
                        {suggestion ? (
                          <p>
                            建议：<b>{suggestion.cityRef.name}</b>
                            <span>
                              {suggestion.reason === "same-day-gps"
                                ? "参考同日照片"
                                : "参考时间相近照片"}{" "}
                              ·{" "}
                              {suggestion.confidence === "high"
                                ? "高"
                                : suggestion.confidence === "medium"
                                  ? "中"
                                  : "低"}
                              置信
                            </span>
                          </p>
                        ) : (
                          <p>
                            没有自动建议
                            <span>可在地图上搜索城市，再点选拍摄位置。</span>
                          </p>
                        )}
                        <div className="location-photo-actions">
                          {suggestion && (
                            <button
                              type="button"
                              className="btn primary"
                              disabled={locationBusy}
                              onClick={() =>
                                void applyLocationSuggestions([photo.id])
                              }
                            >
                              使用{suggestion.cityRef.name}建议
                            </button>
                          )}
                          <button
                            type="button"
                            className={`btn ${suggestion ? "ghost" : "primary"}`}
                            onClick={() =>
                              props.onPickPhotoLocation
                                ? props.onPickPhotoLocation([photo.id], "fill")
                                : setManualIds([photo.id])
                            }
                          >
                            在地图选位置
                          </button>
                        </div>
                      </div>
                    </div>
                    {props.onSetPhotoLocations && (
                      <details className="location-row-advanced">
                        <summary>高级：手动坐标</summary>
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => setManualIds([photo.id])}
                        >
                          填写这张照片的位置
                        </button>
                        {manualIds.length === 1 &&
                          manualIds[0] === photo.id && (
                            <ManualLocationForm
                              count={1}
                              onCancel={() => setManualIds([])}
                              onSave={async (input) => {
                                await props.onSetPhotoLocations!(
                                  [photo.id],
                                  input,
                                );
                                setManualIds([]);
                                props.onTab("candidates");
                              }}
                            />
                          )}
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
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
                      <span className="hint">
                        历史提示 {batch.issueCount} 条
                      </span>
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
