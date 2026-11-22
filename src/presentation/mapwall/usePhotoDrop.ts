import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { droppedPhotos, hasFileDrag } from "./import-selection";

export interface PhotoDropOptions {
  readonly onFiles: (files: readonly File[]) => void | Promise<void>;
  readonly onError?: (error: unknown) => void;
}

/**
 * Page-wide photo drop. Keeps the browser from opening a dropped image and lets the
 * user drop on the map, the drawer or anywhere else instead of aiming at a small zone.
 */
export function usePhotoDrop({ onFiles, onError }: PhotoDropOptions): {
  readonly active: boolean;
  readonly reading: boolean;
} {
  const [active, setActive] = useState(false);
  const [reading, setReading] = useState(false);
  const handlers = useRef({ onFiles, onError });
  useLayoutEffect(() => {
    handlers.current = { onFiles, onError };
  });

  useEffect(() => {
    let live = true;
    let depth = 0;
    const hasFiles = (event: DragEvent) => hasFileDrag(event.dataTransfer);
    const clear = () => {
      depth = 0;
      if (live) setActive(false);
    };

    const onDragEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth += 1;
      if (live) setActive(true);
    };
    const onDragOver = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
      if (live) setActive(true);
    };
    const onDragLeave = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth = Math.max(0, depth - 1);
      if (!event.relatedTarget) {
        clear();
        return;
      }
      if (depth === 0 && live) setActive(false);
    };
    const onDrop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      if (event.defaultPrevented) {
        clear();
        return;
      }
      event.preventDefault();
      const data = event.dataTransfer;
      if (!data) return;
      clear();
      if (live) setReading(true);
      void droppedPhotos(data)
        .then((files) => {
          if (files.length > 0 && live) return handlers.current.onFiles(files);
          return undefined;
        })
        .catch((error: unknown) => {
          if (live) handlers.current.onError?.(error);
        })
        .finally(() => {
          if (live) setReading(false);
        });
    };
    const onDragEnd = () => clear();

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    window.addEventListener("dragend", onDragEnd);
    return () => {
      live = false;
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("dragend", onDragEnd);
    };
  }, []);

  return { active, reading };
}
