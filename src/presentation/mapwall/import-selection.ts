import type { Photo } from "../../domain/photo/photo";

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
