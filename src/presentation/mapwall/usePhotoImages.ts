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
          // A missing thumbnail is not fatal: the deterministic illustration remains.
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
  return urls.get(photo.id) ?? scene(imageSeed(photo.id), photo.palette);
}
