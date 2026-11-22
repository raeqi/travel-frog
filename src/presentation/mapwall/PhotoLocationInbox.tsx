import { useState } from "react";
import type { Candidate } from "../../domain/candidate/candidate";
import type { Photo } from "../../domain/photo/photo";
import type { LocationSuggestion } from "../../domain/services/fill-locations";
import type { Trip } from "../../domain/trip/trip";
import { fmtLocalDate, fmtLocalTime } from "../format";
import { ImportedPhotoPreview } from "./RepairPhotos";
import "./photo-location-inbox.css";

const REASON_LABEL: Record<LocationSuggestion["reason"], string> = {
  "same-day-gps": "同日 GPS",
  "nearest-in-time": "时间最近",
};

const CONFIDENCE_LABEL: Record<LocationSuggestion["confidence"], string> = {
  high: "高",
  medium: "中",
  low: "低",
};

function candidateLabel(candidate: Candidate): string {
  return (
    candidate.cityRefs
      .map((city) => city.name)
      .slice(0, 2)
      .join(" · ") || "未识别地点"
  );
}

export interface PhotoLocationInboxProps {
  readonly photos: readonly Photo[];
  readonly locatedCount: number;
  readonly withoutLocation: number;
  readonly suggestions: readonly LocationSuggestion[];
  readonly candidates: readonly Candidate[];
  readonly trips: readonly Trip[];
  readonly filterCandidateId: string | null;
  readonly filterCandidateTitle?: string | undefined;
  readonly load: ((id: string) => Promise<Blob | null>) | undefined;
  readonly onTag: (ids: readonly string[]) => void;
  readonly onApplySuggestions: (ids: readonly string[]) => Promise<void>;
  readonly onClearFilter?: (() => void) | undefined;
  readonly onGoCandidates?: (() => void) | undefined;
  readonly onRepair?: ((id: string) => void) | undefined;
  readonly onClose: () => void;
}

export function PhotoLocationInbox(props: PhotoLocationInboxProps) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(new Set());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const photos = [...props.photos].sort(
    (a, b) => b.capturedAt - a.capturedAt,
  );
  const photoIds = new Set<string>(photos.map((photo) => photo.id));
  const selectedIds = photos
    .filter((photo) => selected.has(photo.id))
    .map((photo) => photo.id);

  const suggestionByPhoto = new Map(
    props.suggestions.map((item) => [item.photoId, item]),
  );
  const candidateByPhoto = new Map<string, Candidate>();
  for (const candidate of props.candidates) {
    for (const photoId of candidate.photoIds) {
      candidateByPhoto.set(photoId, candidate);
    }
  }
  const tripById = new Map(props.trips.map((trip) => [trip.id, trip]));

  const highConfidence = photos
    .map((photo) => suggestionByPhoto.get(photo.id))
    .filter(
      (item): item is LocationSuggestion =>
        item !== undefined && item.confidence === "high",
    );

  const groups = new Map<string, Photo[]>();
  for (const photo of photos) {
    const day =
      photo.capturedAtSource === "missing" ||
      photo.capturedAtSource === "file-mtime"
        ? "时间未知"
        : fmtLocalDate(photo.capturedAt, photo.captureOffsetMinutes);
    groups.set(day, [...(groups.get(day) ?? []), photo]);
  }

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applySuggestions = async (ids: readonly string[]) => {
    if (!ids.length || busyIds.size > 0) return;
    setError("");
    setMessage("");
    setBusyIds(new Set(ids));
    try {
      await props.onApplySuggestions(ids);
      setSelected((current) => {
        const next = new Set(current);
        for (const id of ids) next.delete(id);
        return next;
      });
      setMessage(`已套用 ${ids.length} 张照片的建议位置`);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "没有套用成功，请重试",
      );
    } finally {
      setBusyIds(new Set());
    }
  };

  const contextFor = (photo: Photo): string => {
    const candidate = candidateByPhoto.get(photo.id);
    if (candidate) return `候选 · ${candidateLabel(candidate)}`;
    if (photo.tripId) {
      const trip = tripById.get(photo.tripId);
      if (trip) return `已归档 · ${trip.title}`;
    }
    return photo.candidateId ? "候选照片" : "未归档";
  };

  return (
    <>
      <div className="li-scrim" onClick={props.onClose} />
      <section
        className="location-inbox"
        role="dialog"
        aria-modal="true"
        aria-label="照片定位工作台"
      >
        <header className="li-head">
          <div>
            <h2>给照片定位</h2>
            <p>
              已定位 {props.locatedCount} 张 · 缺位置 {props.withoutLocation} 张 ·
              有同日建议{" "}
              {
                props.suggestions.filter((item) =>
                  photoIds.has(item.photoId),
                ).length
              }{" "}
              张
            </p>
          </div>
          <button
            className="icon-btn"
            type="button"
            aria-label="关闭定位工作台"
            onClick={props.onClose}
          >
            ×
          </button>
        </header>

        {props.filterCandidateId ? (
          <div className="li-filter">
            <span>
              只显示候选：
              <strong>{props.filterCandidateTitle ?? "当前候选"}</strong>
            </span>
            {props.onClearFilter ? (
              <button className="btn ghost" type="button" onClick={props.onClearFilter}>
                显示全部缺位置照片
              </button>
            ) : null}
          </div>
        ) : null}

        {photos.length === 0 ? (
          <div className="li-empty">
            <strong>
              {props.filterCandidateId
                ? "这组照片都已经有位置了"
                : "所有照片都已经有位置了"}
            </strong>
            <p>位置只保存在本机；以后仍可从回忆大图里修改。</p>
            <div className="li-actions">
              {props.filterCandidateId && props.onGoCandidates ? (
                <button className="btn primary" type="button" onClick={props.onGoCandidates}>
                  去确认候选
                </button>
              ) : null}
              <button className="btn ghost" type="button" onClick={props.onClose}>
                关闭
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="li-toolbar">
              <div className="li-toolbar-copy">
                {selectedIds.length > 0
                  ? `已选 ${selectedIds.length} 张`
                  : `${photos.length} 张待定位`}
              </div>
              <div className="li-toolbar-actions">
                {highConfidence.length > 0 ? (
                  <button
                    className="btn ghost"
                    type="button"
                    disabled={busyIds.size > 0}
                    onClick={() =>
                      void applySuggestions(
                        highConfidence.map((item) => item.photoId),
                      )
                    }
                  >
                    套用高置信建议（{highConfidence.length}）
                  </button>
                ) : null}
                {selectedIds.length > 0 ? (
                  <>
                    <button
                      className="btn primary"
                      type="button"
                      onClick={() => props.onTag(selectedIds)}
                    >
                      给所选 {selectedIds.length} 张标记同一位置
                    </button>
                    <button
                      className="btn ghost"
                      type="button"
                      onClick={() => setSelected(new Set())}
                    >
                      取消选择
                    </button>
                  </>
                ) : (
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={() =>
                      setSelected(new Set(photos.map((photo) => photo.id)))
                    }
                  >
                    全选
                  </button>
                )}
              </div>
            </div>
            {message ? (
              <p className="li-message" role="status">
                {message}
              </p>
            ) : null}
            {error ? (
              <p className="li-error" role="alert">
                {error}
              </p>
            ) : null}

            <div className="li-body">
              {[...groups.entries()].map(([day, dayPhotos]) => (
                <section className="li-day" key={day} aria-label={day}>
                  <h3>
                    {day}
                    <span>{dayPhotos.length} 张</span>
                  </h3>
                  <div className="li-grid">
                    {dayPhotos.map((photo) => {
                      const suggestion = suggestionByPhoto.get(photo.id);
                      const checked = selected.has(photo.id);
                      const busy = busyIds.has(photo.id);
                      return (
                        <article
                          className={`li-card${checked ? " is-selected" : ""}`}
                          key={photo.id}
                        >
                          <label className="li-check">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggle(photo.id)}
                            />
                            <span>选择</span>
                          </label>
                          <div className="li-thumb">
                            <ImportedPhotoPreview
                              photo={photo}
                              load={props.load}
                              className="li-photo"
                            />
                          </div>
                          <div className="li-meta">
                            <strong>{photo.fileName}</strong>
                            <span>
                              {photo.capturedAtSource === "missing" ||
                              photo.capturedAtSource === "file-mtime"
                                ? "时间未知"
                                : fmtLocalTime(
                                    photo.capturedAt,
                                    photo.captureOffsetMinutes,
                                  )}{" "}
                              · {contextFor(photo)}
                            </span>
                          </div>
                          {suggestion ? (
                            <div className="li-suggestion">
                              <span>
                                → {suggestion.cityRef.name} ·{" "}
                                {REASON_LABEL[suggestion.reason]} ·{" "}
                                {CONFIDENCE_LABEL[suggestion.confidence]}
                              </span>
                              <button
                                className="btn ghost"
                                type="button"
                                disabled={busy || busyIds.size > 0}
                                onClick={() => void applySuggestions([photo.id])}
                              >
                                {busy ? "套用中…" : "用这个位置"}
                              </button>
                            </div>
                          ) : (
                            <div className="li-suggestion is-muted">
                              暂无同日位置建议
                            </div>
                          )}
                          <div className="li-card-actions">
                            <button
                              className="btn primary"
                              type="button"
                              onClick={() => props.onTag([photo.id])}
                            >
                              在地图标记
                            </button>
                            {!photo.thumbRef &&
                            props.onRepair &&
                            photo.origin !== "demo" ? (
                              <button
                                className="btn ghost"
                                type="button"
                                onClick={() => props.onRepair?.(photo.id)}
                              >
                                先修复预览
                              </button>
                            ) : null}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
        <footer className="li-foot">
          建议来自同一天或时间最近的有 GPS 照片，只有你点击后才会写入。
        </footer>
      </section>
    </>
  );
}
