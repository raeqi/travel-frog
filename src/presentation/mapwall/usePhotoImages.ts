import { useEffect, useState } from 'react';
import type { TravelFrogService } from '../../application/travel-frog-service';
import { imageSeed, type WallPhoto } from './model';
import { scene } from './photoArt';

/** Loads real thumbnails where the archive has one; demo photos keep deterministic art. */
export function usePhotoImages(photos: readonly WallPhoto[], service: TravelFrogService): ReadonlyMap<string, string> {
  const [urls, setUrls] = useState<ReadonlyMap<string, string>>(() => new Map());

  useEffect(() => {
    let cancelled = false;
    const created: string[] = [];
    setUrls(new Map());

    const load = async () => {
      for (const photo of photos) {
        if (!photo.thumbRef) continue;
        try {
          const blob = await service.thumbnail(photo.id);
          if (!blob || cancelled) continue;
          const url = URL.createObjectURL(blob);
          created.push(url);
          setUrls((previous) => {
            const next = new Map(previous);
            next.set(photo.id, url);
            return next;
          });
        } catch {
          // A missing personal photo is represented honestly, never by demo art.
        }
      }
    };
    void load();

    return () => {
      cancelled = true;
      for (const url of created) URL.revokeObjectURL(url);
    };
  }, [photos, service]);

  return urls;
}

export function photoImage(photo: WallPhoto, urls: ReadonlyMap<string, string>): string {
  const loaded = urls.get(photo.id);
  if (loaded) return loaded;
  if (photo.origin === 'demo') return scene(imageSeed(photo.id), photo.palette);
  return MISSING_PHOTO;
}

/** Explicit placeholder for unavailable personal photos; demo art is never substituted. */
export const MISSING_PHOTO = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320"><rect width="480" height="320" fill="#ece8df"/><path d="M200 125h80v60h-80zM210 170l18-20 18 15 12-10 15 20" fill="none" stroke="#9b978b" stroke-width="3"/><text x="240" y="220" text-anchor="middle" font-size="18" fill="#706d61">照片暂不可用</text></svg>')}`;
