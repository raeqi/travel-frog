import type { ImportSummary } from "../../application/import-photos";
import type { Photo } from "../../domain/photo/photo";

const SUPPORTED_PHOTO = /\.(jpe?g|png|webp|heic|heif)$/i;

interface Entry {
  isFile: boolean;
  isDirectory: boolean;
  file?: (
    ok: (file: File) => void,
    fail: (error: DOMException) => void,
  ) => void;
  createReader?: () => {
    readEntries: (
      ok: (entries: Entry[]) => void,
      fail: (error: DOMException) => void,
    ) => void;
  };
}
/** Directory readers return batches; keep reading until the empty batch, including nested folders. */
export async function filesFromEntry(entry: Entry): Promise<File[]> {
  if (entry.isFile && entry.file)
    return [await new Promise<File>((ok, fail) => entry.file!(ok, fail))];
  if (!entry.isDirectory || !entry.createReader) return [];
  const reader = entry.createReader(),
    files: File[] = [];
  for (;;) {
    const batch = await new Promise<Entry[]>((ok, fail) =>
      reader.readEntries(ok, fail),
    );
    if (!batch.length) break;
    for (const child of batch) files.push(...(await filesFromEntry(child)));
  }
  return files;
}
export async function droppedPhotos(data: DataTransfer): Promise<File[]> {
  const entries = Array.from(data.items)
    .map((item) => item.webkitGetAsEntry?.() ?? null)
    .filter((e): e is FileSystemEntry => e !== null);
  if (!entries.length) return Array.from(data.files);
  const files: File[] = [];
  for (const entry of entries) files.push(...(await filesFromEntry(entry)));
  return files;
}
/** Only boundaries between distinct timestamps can produce two nonempty candidates. */
export function splitBoundaries(
  ids: readonly string[],
  photos: ReadonlyMap<string, Pick<Photo, "capturedAt">>,
): number[] {
  const times = Array.from(
    new Set(
      ids
        .map((id) => photos.get(id)?.capturedAt)
        .filter((t): t is number => t !== undefined),
    ),
  ).sort((a, b) => a - b);
  return times.slice(1);
}

/** A stable key for de-duplicating the same file picked twice or dropped after selection. */
export function fileKey(file: File): string {
  const path =
    (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
    file.name;
  return `${path}\u0000${file.size}\u0000${file.lastModified}`;
}

/** Append newly picked or dropped files without duplicating the current selection. */
export function mergeSelection(
  current: readonly File[],
  incoming: readonly File[],
): File[] {
  const seen = new Set(current.map(fileKey));
  const merged = [...current];
  for (const file of incoming) {
    const key = fileKey(file);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(file);
  }
  return merged;
}

export function removeSelection(
  current: readonly File[],
  key: string,
): File[] {
  return current.filter((file) => fileKey(file) !== key);
}

export function isSupportedPhotoFile(file: File): boolean {
  return SUPPORTED_PHOTO.test(file.name) || file.type.startsWith("image/");
}

export function isHeicFile(file: File): boolean {
  return /\.(heic|heif)$/i.test(file.name) || /image\/(heic|heif)/i.test(file.type);
}

export interface SelectionSummary {
  readonly count: number;
  readonly totalBytes: number;
  readonly heic: number;
  readonly unsupported: number;
}

export function summarizeSelection(files: readonly File[]): SelectionSummary {
  let totalBytes = 0;
  let heic = 0;
  let unsupported = 0;
  for (const file of files) {
    totalBytes += file.size;
    if (isHeicFile(file)) heic += 1;
    else if (!isSupportedPhotoFile(file)) unsupported += 1;
  }
  return { count: files.length, totalBytes, heic, unsupported };
}

export function hasFileDrag(
  dataTransfer: Pick<DataTransfer, "types"> | null | undefined,
): boolean {
  return !!dataTransfer && Array.from(dataTransfer.types).includes("Files");
}

export type ImportNextStep = "repair" | "location" | "candidates" | "done";

/**
 * Decides where the user should go after an import, using only this import's summary.
 * Archive-wide repair photos must not hijack the next step for a clean import.
 */
export function nextStepForImport(summary: ImportSummary): ImportNextStep {
  if (
    summary.failed > 0 ||
    (summary.needsRepair ?? 0) > 0 ||
    (summary.missingTime ?? 0) > 0
  ) {
    return "repair";
  }
  if ((summary.withoutLocation ?? 0) > 0) return "location";
  if (summary.candidateCount > 0) return "candidates";
  return "done";
}
