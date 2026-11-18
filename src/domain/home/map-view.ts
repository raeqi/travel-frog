import { domainError, err, ok, type Result } from '../common/result';
import type { Instant } from '../common/time';

export type MapMode = 'world' | 'city' | 'region';
export type MapLevel = 'world' | 'country' | 'city' | 'region';

export interface MapCamera {
  readonly cx: number;
  readonly cy: number;
  readonly zoom: number;
}

/**
 * The map's view state lives outside the wall component so entering the home and
 * returning can restore exactly where the user was, including the point list scroll.
 */
export interface MapViewState {
  readonly camera: MapCamera;
  readonly mode: MapMode;
  readonly level: MapLevel;
  readonly poiScrollTop: number;
  readonly savedAt: Instant;
  readonly cityKey?: string;
  readonly activeTripId?: string;
}

export const DEFAULT_MAP_VIEW: MapViewState = {
  camera: { cx: 500, cy: 322, zoom: 1 },
  mode: 'world',
  level: 'world',
  poiScrollTop: 0,
  savedAt: 0,
};

function isMode(value: unknown): value is MapMode {
  return value === 'world' || value === 'city' || value === 'region';
}

function isLevel(value: unknown): value is MapLevel {
  return value === 'world' || value === 'country' || value === 'city' || value === 'region';
}

export function validateMapViewState(value: MapViewState): Result<MapViewState> {
  if ((value.cityKey !== undefined && typeof value.cityKey !== 'string') ||
      (value.activeTripId !== undefined && typeof value.activeTripId !== 'string')) {
    return err(domainError('VALIDATION_FAILED', '地图所选位置无效'));
  }
  const { camera } = value;
  if (
    !Number.isFinite(camera.cx) ||
    !Number.isFinite(camera.cy) ||
    !Number.isFinite(camera.zoom) ||
    camera.zoom <= 0
  ) {
    return err(domainError('VALIDATION_FAILED', '地图视图参数无效'));
  }
  if (!isMode(value.mode) || !isLevel(value.level)) {
    return err(domainError('VALIDATION_FAILED', '地图视图级别无效'));
  }
  if (!Number.isFinite(value.poiScrollTop) || value.poiScrollTop < 0) {
    return err(domainError('VALIDATION_FAILED', '点位清单滚动位置无效'));
  }
  if (!Number.isFinite(value.savedAt)) {
    return err(domainError('VALIDATION_FAILED', '地图视图保存时间无效'));
  }
  return ok(value);
}
