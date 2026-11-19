import type { ThumbnailGenerator } from "../../domain/ports";

/**
 * Draws the photo into a canvas at `maxEdge` and encodes it as WebP (JPEG fallback).
 * Runs entirely in the page: no worker, no upload, no EXIF rewriting.
 */
export class CanvasThumbnailGenerator implements ThumbnailGenerator {
  async create(file: File, maxEdge: number): Promise<Blob | null> {
    if (
      typeof createImageBitmap !== "function" ||
      typeof document === "undefined"
    )
      return null;
    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      });
    } catch {
      if (
        !/\.(heic|heif)$/i.test(file.name) &&
        !/image\/(heic|heif)/i.test(file.type)
      )
        return null;
      if (file.size > 25 * 1024 * 1024) return null;
      try {
        const decoderUrl = "/vendor/heic-to-1.6.7.js";
        const decoder = await import(/* @vite-ignore */ decoderUrl);
        bitmap = await decoder.heicTo({ blob: file, type: "bitmap" });
      } catch {
        return null;
      }
    }
    if (!bitmap) return null;
    try {
      const scale = Math.min(
        1,
        maxEdge / Math.max(bitmap.width, bitmap.height),
      );
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) return null;
      context.imageSmoothingQuality = "high";
      context.drawImage(bitmap, 0, 0, width, height);
      return await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((blob) => resolve(blob), "image/webp", 0.8);
      });
    } catch {
      return null;
    } finally {
      bitmap.close();
    }
  }
}
