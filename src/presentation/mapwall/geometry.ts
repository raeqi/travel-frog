import { WORLD_HEIGHT, WORLD_WIDTH } from '../../infrastructure/geo/projection';

export interface Camera {
  readonly cx: number;
  readonly cy: number;
  readonly zoom: number;
}

export interface Metrics {
  readonly boardW: number;
  readonly boardH: number;
  readonly sheetW: number;
  readonly sheetH: number;
  readonly offX: number;
  readonly offY: number;
}

export const WORLD_CAMERA: Camera = { cx: 500, cy: 322, zoom: 1 };
export const EMPTY_METRICS: Metrics = { boardW: 0, boardH: 0, sheetW: 0, sheetH: 0, offX: 0, offY: 0 };

export function projectWorld(lat: number, lng: number): { x: number; y: number } {
  return {
    x: ((lng + 180) / 360) * WORLD_WIDTH,
    y: ((90 - lat) / 180) * WORLD_HEIGHT,
  };
}

/** Detailed street layer for Kyoto: 11000 px per degree around the city centre. */
const CITY_CENTRE = { lat: 35.0116, lng: 135.7681 };
export const CITY_SCALE = 11000;

export function projectCity(lat: number, lng: number): { x: number; y: number } {
  return {
    x: 500 + (lng - CITY_CENTRE.lng) * CITY_SCALE,
    y: 320 - (lat - CITY_CENTRE.lat) * CITY_SCALE,
  };
}

/** Kansai road map used while a trip passes through Uji / Osaka. */
const REGION_CENTRE = { lat: 34.85, lng: 135.55 };
export const REGION_SCALE = 625;

export function projectRegion(lat: number, lng: number): { x: number; y: number } {
  return {
    x: 500 + (lng - REGION_CENTRE.lng) * REGION_SCALE,
    y: 320 - (lat - REGION_CENTRE.lat) * REGION_SCALE,
  };
}

export interface ViewRect {
  readonly viewW: number;
  readonly viewH: number;
  readonly vx: number;
  readonly vy: number;
}

export function viewRect(camera: Camera, metrics: Metrics): ViewRect {
  const viewW = WORLD_WIDTH / camera.zoom;
  const ratio = metrics.sheetW > 0 ? metrics.sheetH / metrics.sheetW : WORLD_HEIGHT / WORLD_WIDTH;
  const viewH = viewW * ratio;
  return { viewW, viewH, vx: camera.cx - viewW / 2, vy: camera.cy - viewH / 2 };
}

export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
  readonly k: number;
}

export function toScreen(point: { x: number; y: number }, camera: Camera, metrics: Metrics): ScreenPoint {
  const view = viewRect(camera, metrics);
  const k = metrics.sheetW / view.viewW;
  return { x: metrics.offX + (point.x - view.vx) * k, y: metrics.offY + (point.y - view.vy) * k, k };
}

export function inBoard(x: number, y: number, metrics: Metrics, pad = 0): boolean {
  return x > -pad && x < metrics.boardW + pad && y > -pad && y < metrics.boardH + pad;
}

export function fnv1a(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash = Math.imul(hash ^ input.charCodeAt(index), 16777619);
  }
  return hash >>> 0;
}

export function rng(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function tiltFor(id: string, base = 6): string {
  return `${((fnv1a(`tilt:${id}`) % (base * 10)) / 10 - base).toFixed(1)}deg`;
}

export function postcardTilt(id: string): string {
  return `${((fnv1a(`pc:${id}`) % 91) / 10 - 4).toFixed(1)}deg`;
}

/** Inverse of the visible projection. Board coordinates include the sheet margins. */
export function mapCoordinate(x:number,y:number,camera:Camera,metrics:Metrics,mode:'world'|'city'|'region'):{lat:number;lng:number}|null {
 const view=viewRect(camera,metrics),k=metrics.sheetW/view.viewW;if(!(k>0))return null;
 const px=view.vx+(x-metrics.offX)/k,py=view.vy+(y-metrics.offY)/k;
 const lng=mode==='city'?135.7681+(px-500)/CITY_SCALE:mode==='region'?135.55+(px-500)/REGION_SCALE:px/1000*360-180;
 const lat=mode==='city'?35.0116-(py-320)/CITY_SCALE:mode==='region'?34.85-(py-320)/REGION_SCALE:90-py/640*180;
 return Number.isFinite(lat)&&Math.abs(lat)<=90&&Number.isFinite(lng)&&Math.abs(lng)<=180?{lat,lng}:null;
}
