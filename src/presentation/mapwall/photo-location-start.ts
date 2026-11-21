import type { Photo } from "../../domain/photo/photo";
import type { LocationSuggestion } from "../../domain/services/fill-locations";
export interface PhotoLocationReference {
  lat: number;
  lng: number;
  label: string;
  kind: "photo" | "suggestion" | "search";
}
/** A reference changes only the starting view. It never supplies the confirmed location. */
export function photoLocationReference(
  ids: readonly string[],
  photos: readonly Photo[],
  suggestions: readonly LocationSuggestion[],
): PhotoLocationReference | null {
  for (const id of ids) {
    const p = photos.find((p) => p.id === id && !p.ignored);
    if (p?.geo)
      return {
        lat: p.geo.lat,
        lng: p.geo.lng,
        label: "原照片位置",
        kind: "photo",
      };
    const s = suggestions.find((s) => s.photoId === id);
    if (p && s)
      return {
        lat: s.geo.lat,
        lng: s.geo.lng,
        label: s.cityRef.name,
        kind: "suggestion",
      };
  }
  return null;
}
