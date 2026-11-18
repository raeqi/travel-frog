import { describe, expect, it } from 'vitest';
import { DEFAULT_MAP_VIEW, validateMapViewState, type MapViewState } from './map-view';

function view(overrides: Partial<MapViewState> = {}): MapViewState {
  return { ...DEFAULT_MAP_VIEW, savedAt: 1_700_000_000_000, ...overrides };
}

describe('map view validation', () => {
  it('accepts the default view and every persisted field', () => {
    expect(validateMapViewState(view()).ok).toBe(true);
    expect(
      validateMapViewState(
        view({ camera: { cx: 12, cy: 34, zoom: 3.2 }, mode: 'city', level: 'region', poiScrollTop: 240 }),
      ).ok,
    ).toBe(true);
  });

  it('rejects camera values that cannot be rendered', () => {
    expect(validateMapViewState(view({ camera: { cx: Number.NaN, cy: 0, zoom: 1 } })).ok).toBe(false);
    expect(validateMapViewState(view({ camera: { cx: 0, cy: Infinity, zoom: 1 } })).ok).toBe(false);
    expect(validateMapViewState(view({ camera: { cx: 0, cy: 0, zoom: 0 } })).ok).toBe(false);
    expect(validateMapViewState(view({ camera: { cx: 0, cy: 0, zoom: -2 } })).ok).toBe(false);
  });

  it('rejects unknown map modes and levels', () => {
    expect(validateMapViewState(view({ mode: 'country' as never })).ok).toBe(false);
    expect(validateMapViewState(view({ level: 'planet' as never })).ok).toBe(false);
  });

  it('rejects a negative or non-finite point list scroll position', () => {
    expect(validateMapViewState(view({ poiScrollTop: -1 })).ok).toBe(false);
    expect(validateMapViewState(view({ poiScrollTop: Number.NaN })).ok).toBe(false);
  });

  it('rejects a view without a usable saved time', () => {
    expect(validateMapViewState(view({ savedAt: Number.NaN })).ok).toBe(false);
  });
});
