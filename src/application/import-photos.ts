import {
  candidateIdFor,
  DEFAULT_SPLIT_CONFIG,
  splitPhotosIntoTrips,
} from "../domain/services/split-trips";
import { createCandidate, type Candidate } from "../domain/candidate/candidate";
import {
  createPhoto,
  type Photo,
  type PhotoIssue,
} from "../domain/photo/photo";
import { makeGeoPoint } from "../domain/geo/geo-point";
import type {
  ImportBatch,
  ImportIssue,
  ImportIssueCode,
} from "../domain/import/import-issue";
import { ISSUE_LABELS } from "../domain/import/import-issue";
import { DomainViolation } from "../domain/common/result";
import { asImportBatchId, asImportIssueId } from "../domain/common/ids";
import type {
  Clock,
  ExifReader,
  FingerprintReader,
  IdGenerator,
  Logger,
  ThumbnailGenerator,
  CityResolver,
} from "../domain/ports";
import { AppError, type ArchiveGateway } from "./ports";

export interface ImportDeps {
  readonly gateway: ArchiveGateway;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly exif: ExifReader;
  readonly thumbnails: ThumbnailGenerator;
  readonly fingerprints: FingerprintReader;
  readonly cityResolver: CityResolver;
  readonly logger: Logger;
}

export interface ImportSummary {
  readonly batchId: string;
  readonly imported: number;
  readonly duplicates: number;
  readonly failed: number;
  readonly candidateCount: number;
  readonly ready?: number;
  readonly needsRepair?: number;
  readonly repaired?: number;
  readonly withLocation?: number;
  readonly withoutLocation?: number;
  readonly missingTime?: number;
  readonly issues: readonly ImportIssue[];
}

export interface ImportProgress {
  readonly done: number;
  readonly total: number;
  readonly fileName: string;
  readonly stage?:
    | "metadata"
    | "preview"
    | "candidates"
    | "saving"
    | "completed";
}

const SUPPORTED = /\.(jpe?g|png|webp|heic|heif)$/i;
/** Two files in flight overlap I/O and decode without holding many full images in memory. */
const IMPORT_CONCURRENCY = 2;

function severityOf(code: ImportIssueCode): "info" | "warning" | "error" {
  switch (code) {
    case "unsupported-format":
    case "storage-failed":
      return "error";
    case "duplicate":
      return "info";
    case "thumbnail-failed":
      return "error";
    default:
      return "warning";
  }
}

function issue(
  deps: ImportDeps,
  batchId: string,
  fileName: string,
  code: ImportIssueCode,
  detail: string,
): ImportIssue {
  return {
    id: asImportIssueId(deps.ids.newImportIssueId()),
    batchId: asImportBatchId(batchId),
    fileName,
    code,
    severity: severityOf(code),
    message: `${ISSUE_LABELS[code]}：${detail}`,
    createdAt: deps.clock.now(),
  };
}

function photoIssue(code: ImportIssueCode, detail: string): PhotoIssue {
  return {
    code,
    severity: severityOf(code),
    message: `${ISSUE_LABELS[code]}：${detail}`,
  };
}

function isFuture(capturedAt: number, now: number): boolean {
  return capturedAt - now > 24 * 3_600_000;
}

function assertActive(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new AppError("IMPORT_CANCELLED", "已取消导入，未写入任何照片");
  }
}

/**
 * Parses a file into a Photo plus zero or more issues. Never throws for a single bad file:
 * the caller records the issue and keeps importing the rest. Storage failures still throw.
 */
async function toPhoto(
  deps: ImportDeps,
  file: File,
  batchId: string,
  existingHashes: ReadonlyMap<string, string>,
  batchHashes: Set<string>,
  broken: ReadonlyMap<string, Photo>,
  onPreview: () => void,
  signal?: AbortSignal,
): Promise<
  | { photo: Photo; issues: ImportIssue[]; thumbnail: Blob | null }
  | { duplicate: ImportIssue }
> {
  const now = deps.clock.now();
  const issues: ImportIssue[] = [];

  if (!SUPPORTED.test(file.name) && !file.type.startsWith("image/")) {
    issues.push(
      issue(
        deps,
        batchId,
        file.name,
        "unsupported-format",
        "仅支持 JPG / PNG / WebP / HEIC",
      ),
    );
  }

  const exif = await deps.exif.read(file);
  assertActive(signal);
  if (exif.error === "exif-unreadable" || exif.error === "unreadable-file") {
    issues.push(
      issue(
        deps,
        batchId,
        file.name,
        "exif-unreadable",
        "元数据损坏，已按文件时间导入",
      ),
    );
  }

  const fingerprint = await deps.fingerprints.hash(file);
  assertActive(signal);
  if (
    (existingHashes.has(fingerprint.hash) &&
      !broken.has(existingHashes.get(fingerprint.hash)!)) ||
    batchHashes.has(fingerprint.hash)
  ) {
    return {
      duplicate: issue(
        deps,
        batchId,
        file.name,
        "duplicate",
        "与已导入照片内容相同，已跳过",
      ),
    };
  }
  batchHashes.add(fingerprint.hash);
  if (fingerprint.weak) {
    deps.logger.warn("import.weak-fingerprint", { fileName: file.name });
  }

  const previous = broken.get(existingHashes.get(fingerprint.hash) ?? "");
  const id = previous?.id ?? deps.ids.newPhotoId();
  let capturedAt: number;
  let capturedAtSource: Photo["capturedAtSource"];
  let offsetMinutes: number | null;
  let offsetSource: Photo["offsetSource"];
  let originalCapturedAt: number | null = null;

  if (exif.capturedAt !== null) {
    capturedAtSource = exif.capturedAtSource ?? "exif-original";
    if (exif.offsetMinutes !== null) {
      capturedAt = exif.capturedAt;
      offsetMinutes = exif.offsetMinutes;
      offsetSource = "exif";
    } else {
      offsetMinutes = deps.clock.localOffsetMinutes(exif.capturedAt);
      originalCapturedAt = exif.capturedAt;
      capturedAt = exif.capturedAt - offsetMinutes * 60_000;
      offsetSource = "device";
    }
  } else {
    const fallback =
      Number.isFinite(file.lastModified) && file.lastModified > 0
        ? file.lastModified
        : now;
    capturedAt = fallback;
    capturedAtSource = "missing";
    offsetMinutes = deps.clock.localOffsetMinutes(fallback);
    offsetSource = "device";
    issues.push(
      issue(
        deps,
        batchId,
        file.name,
        "no-timestamp",
        "没有 EXIF 拍摄时间，暂记未知；请手动填写后再生成旅行",
      ),
    );
  }

  if (isFuture(capturedAt, now)) {
    issues.push(
      issue(
        deps,
        batchId,
        file.name,
        "future-clock",
        "拍摄时间在未来，已导入但不会自动切分",
      ),
    );
  }

  let geo = null;
  let locationSource: Photo["locationSource"] = "none";
  if (exif.geo) {
    const point = makeGeoPoint({
      lat: exif.geo.lat,
      lng: exif.geo.lng,
      source: "exif",
      approximate: false,
    });
    if (point.ok) {
      geo = point.value;
      locationSource = "exif";
    } else {
      issues.push(
        issue(
          deps,
          batchId,
          file.name,
          "invalid-geo",
          "GPS 坐标无效，照片已保留",
        ),
      );
    }
  }

  assertActive(signal);
  onPreview();
  const thumbnail = await deps.thumbnails.create(file, 2048);
  assertActive(signal);
  const thumbRef = thumbnail ? `thumb_${id}` : null;
  if (!thumbnail)
    issues.push(
      issue(
        deps,
        batchId,
        file.name,
        "thumbnail-failed",
        "无法生成真实照片预览；记录已保留，需重试解码，不能视为照片已就绪",
      ),
    );

  const created = createPhoto({
    id,
    importBatchId: asImportBatchId(batchId),
    fileName: file.name,
    mimeType: file.type || "image/jpeg",
    byteSize: Math.max(1, file.size),
    contentHash: fingerprint.hash,
    capturedAt,
    capturedAtSource,
    captureOffsetMinutes: offsetMinutes,
    offsetSource,
    originalCapturedAt,
    geo,
    locationSource,
    thumbRef,
    origin: "user",
    importedAt: now,
    issues: issues.map((item) => photoIssue(item.code, item.message)),
  });
  if (!created.ok) {
    throw new DomainViolation(created.error);
  }
  const photo = previous
    ? {
        ...previous,
        thumbRef: thumbnail ? `thumb_${previous.id}` : null,
        issues: thumbnail
          ? previous.issues.filter((i) => i.code !== "thumbnail-failed")
          : previous.issues,
        updatedAt: now,
      }
    : created.value;
  return { photo, issues, thumbnail };
}

export async function importPhotos(
  deps: ImportDeps,
  files: readonly File[],
  onProgress?: (progress: ImportProgress) => void,
  signal?: AbortSignal,
): Promise<ImportSummary> {
  const now = deps.clock.now();
  const batchId = deps.ids.newImportBatchId();
  const startedAt = now;

  if (files.length === 0) {
    throw new AppError("INVALID_INPUT", "请先选择照片");
  }

  const existingHashes = await deps.gateway.read(async (repos) => {
    const map = await repos.photos.hashes();
    const out = new Map<string, string>();
    for (const [hash, id] of map) out.set(hash, id);
    return out;
  });

  const broken = await deps.gateway.read(async (repos) => {
    const found = new Map<string, Photo>();
    for (const photo of await repos.photos.listAll())
      if (!photo.thumbRef || !(await repos.thumbnails.get(photo.thumbRef)))
        found.set(photo.id, photo);
    return found;
  });
  const batchHashes = new Set<string>();
  const photos: Photo[] = [];
  const thumbnails: { key: string; blob: Blob }[] = [];
  let repaired = 0;
  const issues: ImportIssue[] = [];
  let duplicates = 0;
  let failed = 0;

  type FileOutcome =
    | { readonly kind: "duplicate"; readonly issue: ImportIssue }
    | {
        readonly kind: "photo";
        readonly photo: Photo;
        readonly thumbnail: Blob | null;
        readonly issues: ImportIssue[];
        readonly file: File;
      }
    | {
        readonly kind: "failed";
        readonly error: unknown;
        readonly fileName: string;
      };

  const results: Array<FileOutcome | undefined> = new Array(files.length);
  let nextIndex = 0;
  let completed = 0;

  const worker = async (): Promise<void> => {
    for (;;) {
      assertActive(signal);
      const index = nextIndex;
      nextIndex += 1;
      if (index >= files.length) return;
      const file = files[index];
      if (!file) {
        completed += 1;
        continue;
      }
      onProgress?.({
        done: completed,
        total: files.length,
        fileName: file.name,
        stage: "metadata",
      });
      try {
        const result = await toPhoto(
          deps,
          file,
          batchId,
          existingHashes,
          batchHashes,
          broken,
          () =>
            onProgress?.({
              done: completed,
              total: files.length,
              fileName: file.name,
              stage: "preview",
            }),
          signal,
        );
        results[index] =
          "duplicate" in result
            ? { kind: "duplicate", issue: result.duplicate }
            : {
                kind: "photo",
                photo: result.photo,
                thumbnail: result.thumbnail,
                issues: result.issues,
                file,
              };
      } catch (error) {
        if (signal?.aborted) return;
        results[index] = { kind: "failed", error, fileName: file.name };
      }
      completed += 1;
      onProgress?.({
        done: completed,
        total: files.length,
        fileName: file.name,
        stage: "preview",
      });
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(IMPORT_CONCURRENCY, files.length) },
      () => worker(),
    ),
  );
  assertActive(signal);

  for (const result of results) {
    if (!result) continue;
    if (result.kind === "duplicate") {
      duplicates += 1;
      issues.push(result.issue);
      continue;
    }
    if (result.kind === "failed") {
      failed += 1;
      deps.logger.error("import.file-failed", result.error, {
        fileName: result.fileName,
      });
      issues.push(
        issue(
          deps,
          batchId,
          result.fileName,
          "storage-failed",
          "无法解析或缩略图生成失败",
        ),
      );
      continue;
    }
    const existing = broken.has(result.photo.id);
    if (existing && result.thumbnail) repaired++;
    const file = result.file;
    const photo =
      !result.thumbnail && file.size <= 25 * 1024 * 1024
        ? { ...result.photo, sourceRef: `source_${result.photo.id}` }
        : result.photo;
    photos.push(photo);
    if (!result.thumbnail && photo.sourceRef) {
      thumbnails.push({ key: photo.sourceRef, blob: file });
    }
    issues.push(...result.issues);
    if (result.thumbnail && result.photo.thumbRef) {
      thumbnails.push({ key: result.photo.thumbRef, blob: result.thumbnail });
    }
  }

  onProgress?.({
    done: files.length,
    total: files.length,
    fileName: "",
    stage: "candidates",
  });
  const resolvable = photos.filter(
    (photo) =>
      !existingHashes.has(photo.contentHash ?? "") &&
      photo.capturedAtSource !== "missing" &&
      !isFuture(photo.capturedAt, now),
  );
  const splitResult = splitPhotosIntoTrips({
    photos: resolvable,
    config: DEFAULT_SPLIT_CONFIG,
    existingTrips: [],
    defaultOffsetMinutes: deps.clock.localOffsetMinutes(now),
    now,
    resolveCity: (geo) => deps.cityResolver.resolve(geo),
  });
  if (!splitResult.ok) throw new DomainViolation(splitResult.error);

  const candidates: Candidate[] = [];
  const candidateIdByPhoto = new Map<string, string>();
  for (const draft of splitResult.value.candidates) {
    const first = draft.photoIds[0];
    const last = draft.photoIds[draft.photoIds.length - 1];
    if (!first || !last) continue;
    const id = candidateIdFor(first, last);
    const created = createCandidate({
      id,
      importBatchId: asImportBatchId(batchId),
      timeRange: draft.timeRange,
      photoIds: draft.photoIds,
      cityRefs: draft.cityRefs,
      locationMissingCount: draft.locationMissingCount,
      splitReasons: draft.splitReasons,
      confidence: draft.confidence,
      derivedFrom: [],
      origin: "user",
      createdAt: now,
    });
    if (!created.ok) throw new DomainViolation(created.error);
    candidates.push(created.value);
    for (const photoId of draft.photoIds) candidateIdByPhoto.set(photoId, id);
  }

  const batch: ImportBatch = {
    id: asImportBatchId(batchId),
    startedAt,
    finishedAt: deps.clock.now(),
    sourceFileCount: files.length,
    photoCount: photos.length,
    issueCount: issues.length,
    candidateCount: candidates.length,
    status:
      photos.some((p) => !p.thumbRef || p.capturedAtSource === "missing") ||
      failed > 0
        ? "needs-attention"
        : "completed",
    origin: "user",
  };

  assertActive(signal);
  onProgress?.({
    done: files.length,
    total: files.length,
    fileName: "",
    stage: "saving",
  });
  try {
    await deps.gateway.run(async (repos) => {
      await repos.batches.save(batch);
      if (issues.length > 0) await repos.issues.saveMany(issues);
      const linked = photos.map((photo) => {
        const candidateId = candidateIdByPhoto.get(photo.id);
        return candidateId ? { ...photo, candidateId } : photo;
      });
      await repos.photos.saveMany(linked);
      if (candidates.length > 0) await repos.candidates.saveMany(candidates);
      for (const item of thumbnails)
        await repos.thumbnails.put(item.key, item.blob);
    });
  } catch (error) {
    deps.logger.error("import.commit-failed", error, { batchId });
    throw new AppError(
      "STORAGE_FAILED",
      "这次导入没有写入本地数据库，照片没有被添加。请检查存储空间后重试。",
    );
  }

  onProgress?.({
    done: files.length,
    total: files.length,
    fileName: "",
    stage: "completed",
  });
  return {
    batchId,
    imported: photos.filter((p) => !existingHashes.has(p.contentHash ?? ""))
      .length,
    duplicates,
    failed,
    ready: photos.filter((p) => p.thumbRef).length,
    needsRepair: photos.filter(
      (p) => !p.thumbRef || p.capturedAtSource === "missing",
    ).length,
    withLocation: photos.filter((p) => p.geo !== null).length,
    withoutLocation: photos.filter((p) => p.geo === null).length,
    missingTime: photos.filter(
      (p) =>
        p.capturedAtSource === "missing" ||
        p.capturedAtSource === "file-mtime",
    ).length,
    repaired,
    candidateCount: candidates.length,
    issues,
  };
}
