import type { Camera, Metrics } from './geometry';
export type ProjectionMode = 'world' | 'city' | 'region';
export const MERCATOR_LIMIT = 85.0511287798066;
const clampLat = (lat: number) => Math.max(-MERCATOR_LIMIT, Math.min(MERCATOR_LIMIT, lat));
export function legacyGeo(point: { x: number; y: number }, mode: ProjectionMode) {
  return mode === 'city' ? { lng: 135.7681 + (point.x - 500) / 11000, lat: 35.0116 - (point.y - 320) / 11000 }
    : mode === 'region' ? { lng: 135.55 + (point.x - 500) / 625, lat: 34.85 - (point.y - 320) / 625 }
    : { lng: point.x / 1000 * 360 - 180, lat: 90 - point.y / 640 * 180 };
}
export function legacyPoint(point: {lat:number;lng:number}, mode: ProjectionMode) {
  return mode === 'city' ? {x:500+(point.lng-135.7681)*11000,y:320-(point.lat-35.0116)*11000}
    : mode === 'region' ? {x:500+(point.lng-135.55)*625,y:320-(point.lat-34.85)*625}
    : {x:(point.lng+180)/360*1000,y:(90-point.lat)/180*640};
}
export function normalizedMercator(point: {lat:number;lng:number}) {
  const phi=clampLat(point.lat)*Math.PI/180;
  return {x:(point.lng+180)/360,y:(1-Math.log(Math.tan(Math.PI/4+phi/2))/Math.PI)/2};
}
export function inverseMercator(point: {x:number;y:number}) {
  return {lng:point.x*360-180,lat:Math.atan(Math.sinh(Math.PI*(1-2*point.y)))*180/Math.PI};
}
export function mercatorView(camera:Camera,metrics:Metrics,mode:ProjectionMode) {
  const center=legacyGeo({x:camera.cx,y:camera.cy},mode);
  const units=mode==='city'?11000:mode==='region'?625:1000/360;
  const worldSize=Math.max(1,metrics.sheetW)*camera.zoom*units*360/1000;
  return {center:{lng:Math.max(-180,Math.min(180,center.lng)),lat:clampLat(center.lat)},worldSize,zoom:Math.log2(worldSize/512)};
}
export function mercatorToScreen(point:{x:number;y:number},camera:Camera,metrics:Metrics,mode:ProjectionMode) {
  const view=mercatorView(camera,metrics,mode),center=normalizedMercator(view.center),p=normalizedMercator(legacyGeo(point,mode));
  return {x:metrics.offX+metrics.sheetW/2+(p.x-center.x)*view.worldSize,y:metrics.offY+metrics.sheetH/2+(p.y-center.y)*view.worldSize,k:metrics.sheetW*camera.zoom/1000};
}
export function mercatorCoordinate(x:number,y:number,camera:Camera,metrics:Metrics,mode:ProjectionMode) {
  if(metrics.sheetW<=0)return null;
  const view=mercatorView(camera,metrics,mode),center=normalizedMercator(view.center);
  const p=inverseMercator({x:center.x+(x-metrics.offX-metrics.sheetW/2)/view.worldSize,y:center.y+(y-metrics.offY-metrics.sheetH/2)/view.worldSize});
  return Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&Math.abs(p.lat)<=MERCATOR_LIMIT&&Math.abs(p.lng)<=180?p:null;
}
export function panMercator(camera:Camera,dx:number,dy:number,metrics:Metrics,mode:ProjectionMode):Camera {
  const view=mercatorView(camera,metrics,mode),center=normalizedMercator(view.center);
  const p=inverseMercator({x:Math.max(0,Math.min(1,center.x-dx/view.worldSize)),y:Math.max(0,Math.min(1,center.y-dy/view.worldSize))});
  const legacy=legacyPoint(p,mode);return {cx:legacy.x,cy:legacy.y,zoom:camera.zoom};
}
