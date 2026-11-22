import type { WallModel, WallPhoto } from './model';

/** Map grouping cityKey may be inferred from an arbitrarily distant reference.
 * Postcards require explicit matching-city visit membership in the same trip. */
export function postcardFootprints(model: WallModel, cityKey: string): WallPhoto[] {
  const recent = (a: WallPhoto, b: WallPhoto) => b.capturedAt - a.capturedAt || a.id.localeCompare(b.id);
  const visits = model.visits.filter(v => v.cityKey === cityKey).slice().sort((a,b) => b.start-a.start || a.id.localeCompare(b.id));
  const ordered = visits.flatMap(v => v.photoIds.map(id => model.photoById.get(id)).filter((p):p is WallPhoto => !!p && p.tripId === v.tripId).sort(recent));
  const ids = new Set<string>(), thumbnails = new Set<string>();
  return ordered.filter(p => {
    if(p.cityKey !== cityKey || p.origin === 'demo' || !p.thumbRef || ids.has(p.id) || thumbnails.has(p.thumbRef)) return false;
    ids.add(p.id); thumbnails.add(p.thumbRef); return true;
  });
}
