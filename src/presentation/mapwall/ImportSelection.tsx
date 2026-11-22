import { useEffect, useState } from "react";
import {
  fileKey,
  isHeicFile,
  isSupportedPhotoFile,
  summarizeSelection,
} from "./import-selection";

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(0, Math.round(bytes / 1024))} KB`;
}

function extensionOf(file: File): string {
  const match = /\.([a-z0-9]+)$/i.exec(file.name);
  return (match?.[1] ?? "FILE").toUpperCase();
}

function SelectionThumb({
  file,
  onRemove,
  disabled,
}: {
  file: File;
  onRemove: (key: string) => void;
  disabled: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const heic = isHeicFile(file);
  const previewable = isSupportedPhotoFile(file) && !heic;
  useEffect(() => {
    if (!previewable) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file, previewable]);
  return (
    <div className="import-thumb" title={file.name}>
      {url && !failed ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="import-thumb-fallback">
          {heic ? "HEIC" : extensionOf(file)}
        </span>
      )}
      <button
        className="import-thumb-remove"
        type="button"
        disabled={disabled}
        aria-label={`移除 ${file.name}`}
        onClick={() => onRemove(fileKey(file))}
      >
        ×
      </button>
      <small>{file.name}</small>
    </div>
  );
}

export interface ImportSelectionProps {
  readonly files: readonly File[];
  readonly importing: boolean;
  readonly onImport: () => void;
  readonly onAdd: () => void;
  readonly onClear: () => void;
  readonly onRemove: (key: string) => void;
}

export function ImportSelection({
  files,
  importing,
  onImport,
  onAdd,
  onClear,
  onRemove,
}: ImportSelectionProps) {
  const [showAll, setShowAll] = useState(false);
  if (files.length === 0) return null;
  const summary = summarizeSelection(files);
  const visible = files.slice(0, 6);
  const remaining = files.length - visible.length;
  const listed = files.slice(0, 200);

  return (
    <section className="card import-selection" aria-label="本次选择">
      <h3>本次选择 · {summary.count} 个文件</h3>
      <p className="note">
        {formatBytes(summary.totalBytes)}
        {summary.heic > 0 ? ` · ${summary.heic} 个 HEIC` : ""}
        {summary.unsupported > 0
          ? ` · ${summary.unsupported} 个格式待检查`
          : ""}
        {" · "}按时间和位置生成候选，确认前不会成为旅行。
      </p>
      <div className="import-selection-actions">
        <button
          className="btn primary"
          type="button"
          disabled={importing}
          onClick={onImport}
        >
          导入 {summary.count} 个文件
        </button>
        <button
          className="btn ghost"
          type="button"
          disabled={importing}
          onClick={onAdd}
        >
          继续添加
        </button>
        <button
          className="btn ghost"
          type="button"
          disabled={importing}
          onClick={onClear}
        >
          取消选择
        </button>
      </div>
      <div className="import-thumbs">
        {visible.map((file) => (
          <SelectionThumb
            key={fileKey(file)}
            file={file}
            onRemove={onRemove}
            disabled={importing}
          />
        ))}
        {remaining > 0 ? (
          <button
            className="import-thumb-more"
            type="button"
            onClick={() => setShowAll((value) => !value)}
          >
            +{remaining}
            <small>{showAll ? "收起列表" : "查看全部"}</small>
          </button>
        ) : null}
      </div>
      {showAll ? (
        <ul className="import-file-list" aria-label="全部已选文件">
          {listed.map((file) => (
            <li key={fileKey(file)}>
              <span
                className="import-file-name"
                title={
                  (file as File & { webkitRelativePath?: string })
                    .webkitRelativePath || file.name
                }
              >
                {(file as File & { webkitRelativePath?: string })
                  .webkitRelativePath || file.name}
              </span>
              <small>
                {isHeicFile(file) ? "需浏览器解码" : extensionOf(file)} ·{" "}
                {formatBytes(file.size)}
              </small>
              <button
                type="button"
                className="icon-btn"
                disabled={importing}
                aria-label={`移除 ${file.name}`}
                onClick={() => onRemove(fileKey(file))}
              >
                ×
              </button>
            </li>
          ))}
          {files.length > listed.length ? (
            <li className="note">
              还有 {files.length - listed.length} 个文件只在导入时列出。
            </li>
          ) : null}
        </ul>
      ) : null}
    </section>
  );
}
