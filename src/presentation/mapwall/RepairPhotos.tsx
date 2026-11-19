import { useEffect, useState } from "react";
import type { Photo } from "../../domain/photo/photo";
export function ImportedPhotoPreview({
  photo,
  load,
}: {
  photo: Photo;
  load?: ((id: string) => Promise<Blob | null>) | undefined;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    let created: string | undefined;
    if (load && photo.thumbRef)
      void load(photo.id)
        .then((blob) => {
          if (blob && live) {
            created = URL.createObjectURL(blob);
            setUrl(created);
          }
        })
        .catch(() => {});
    return () => {
      live = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [photo.id, photo.thumbRef, load]);
  return (
    <span data-preview-photo={photo.id}>
      {url ? (
        <img
          src={url}
          alt={photo.fileName}
          style={{ width: 90, height: 65, objectFit: "cover" }}
        />
      ) : (
        <span>{photo.thumbRef ? "照片预览加载中" : "照片未解码"}</span>
      )}
    </span>
  );
}
export function RepairPhoto({
  photo,
  load,
  onRetry,
  onTime,
}: {
  photo: Photo;
  load?: ((id: string) => Promise<Blob | null>) | undefined;
  onRetry: (id: string, file?: File) => Promise<void>;
  onTime: (id: string, at: number | null) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState("");
  const run = async (task: () => Promise<void>, success: string) => {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await task();
      setStatus(success);
    } catch (e) {
      setError(e instanceof Error ? e.message : "未保存，请重试");
    } finally {
      setBusy(false);
    }
  };
  const timeMissing =
    photo.capturedAtSource === "missing" ||
    photo.capturedAtSource === "file-mtime";
  return (
    <section className="card" aria-label={`修复 ${photo.fileName}`}>
      <h4>{photo.fileName}</h4>
      <ImportedPhotoPreview photo={photo} load={load} />
      <p>
        {photo.thumbRef
          ? "真实照片预览已保存"
          : "尚无真实照片预览，不能视为照片导入成功"}
        {timeMissing ? " · 拍摄时间待确认" : ""}
        {!photo.geo ? " · 缺位置" : ""}
      </p>
      <fieldset
        disabled={busy}
        style={{ border: 0, padding: 0, display: "grid", gap: 12 }}
      >
        {!photo.thumbRef && (
          <>
            <p>
              {photo.sourceRef
                ? "本机保留了这份失败文件，可直接重试。"
                : "这条旧记录未保留原文件，请重新选择同一张原图；会修复原记录，不新增重复照片。"}
            </p>
            {photo.sourceRef && (
              <button
                className="btn primary"
                type="button"
                onClick={() =>
                  void run(() => onRetry(photo.id), "照片预览已修复")
                }
              >
                重试解码
              </button>
            )}
            <label>
              重新选择原文件修复
              <input
                type="file"
                accept="image/*,.heic,.heif"
                aria-label={`重新选择原文件 ${photo.fileName}`}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file)
                    void run(() => onRetry(photo.id, file), "原照片预览已修复");
                  e.target.value = "";
                }}
              />
            </label>
            <p>
              HEIC/HEIF
              使用本机解码器，照片不会上传给转换服务；仍不支持时请在设备本地导出
              JPG 后导入。
            </p>
          </>
        )}
        {timeMissing && !photo.tripId && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const FormDataClass =
                e.currentTarget.ownerDocument.defaultView!.FormData;
              const date = String(
                new FormDataClass(e.currentTarget).get("capturedAt") ?? "",
              );
              void run(async () => {
                if (!date) throw new Error("请选择拍摄时间");
                const at = new Date(date).getTime();
                await onTime(photo.id, at);
              }, "拍摄时间已保存，请继续查看候选");
            }}
          >
            <label>
              手动拍摄时间（当前设备时区）
              <input
                required
                type="datetime-local"
                aria-label={`拍摄时间 ${photo.fileName}`}
                name="capturedAt"
              />
            </label>
            <button className="btn primary" type="submit">
              保存拍摄时间
            </button>
            <button
              className="btn ghost"
              type="button"
              onClick={() =>
                void run(
                  () => onTime(photo.id, null),
                  "已保留未知时间，暂不自动生成旅行",
                )
              }
            >
              保留未知时间，稍后整理
            </button>
            <p>
              没有 EXIF
              时不会把导入时间冒充拍摄时间。你填写的时间会明确标为“手动”。
            </p>
          </form>
        )}
      </fieldset>
      {busy && <p role="status">正在处理…</p>}
      {status && <p role="status">{status}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
