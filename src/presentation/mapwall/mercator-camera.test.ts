import {describe,it,expect} from 'vitest';
import {MercatorCoordinate} from 'maplibre-gl';
import {projectWorld,toScreen,mapCoordinate,type Metrics} from './geometry';
import {legacyGeo,legacyPoint,mercatorView} from './mercator-camera';
import {panCamera,zoomCamera} from './map-gestures';
import {photoLocationCamera} from './photo-location-camera';
const metrics:Metrics={boardW:1100,boardH:720,sheetW:900,sheetH:570,offX:100,offY:70,mercatorMode:'world'};
describe('whole-wall geographic alignment',()=>{
 it('matches MapLibre at the equator, Kyoto, and high latitudes without moving saved coordinates',()=>{
  for(const center of [{lat:35.0116,lng:135.7681},{lat:0,lng:0},{lat:70,lng:24}]){
   const p=projectWorld(center.lat,center.lng),camera={cx:p.x,cy:p.y,zoom:2500};
   const point={lat:center.lat+.015,lng:center.lng+.021},original=structuredClone(point),v=mercatorView(camera,metrics,'world');
   const c=MercatorCoordinate.fromLngLat(v.center),actual=MercatorCoordinate.fromLngLat(point),s=toScreen(projectWorld(point.lat,point.lng),camera,metrics);
   expect(s.x).toBeCloseTo(metrics.offX+metrics.sheetW/2+(actual.x-c.x)*512*2**v.zoom,7);
   expect(s.y).toBeCloseTo(metrics.offY+metrics.sheetH/2+(actual.y-c.y)*512*2**v.zoom,7);
   const back=mapCoordinate(s.x,s.y,camera,metrics,'world')!;expect(back.lat).toBeCloseTo(point.lat,9);expect(back.lng).toBeCloseTo(point.lng,9);expect(point).toEqual(original);
  }
 });
 it('keeps a zoom anchor fixed and moves overlays by the exact drag distance',()=>{
  const p=projectWorld(65,25),camera={cx:p.x,cy:p.y,zoom:2400},x=680,y=295,anchor=mapCoordinate(x,y,camera,metrics,'world')!;
  const zoomed=zoomCamera(camera,1.8,x,y,metrics,400000),after=toScreen(projectWorld(anchor.lat,anchor.lng),zoomed,metrics);expect(after.x).toBeCloseTo(x,6);expect(after.y).toBeCloseTo(y,6);
  const moved=panCamera(camera,83,-27,metrics,400000),origin=toScreen(p,camera,metrics),dragged=toScreen(p,moved,metrics);expect(dragged.x-origin.x).toBeCloseTo(83,6);expect(dragged.y-origin.y).toBeCloseTo(-27,6);
 });
 it('supports legacy city/region view records without migrating photo or camera storage',()=>{
  for(const mode of ['city','region'] as const){const geo={lat:35.01,lng:135.77},p=legacyPoint(geo,mode),m={...metrics,mercatorMode:mode},camera={cx:p.x,cy:p.y,zoom:1};expect(legacyGeo(p,mode)).toEqual(geo);const s=toScreen(p,camera,m);expect(s.x).toBeCloseTo(550);expect(s.y).toBeCloseTo(355);expect(mapCoordinate(s.x,s.y,camera,m,mode)!.lat).toBeCloseTo(geo.lat,9);}
 });
 it('reframes the camera above a mobile card without changing the selected point',()=>{
  const point={lat:35.0116,lng:135.7681},p=projectWorld(point.lat,point.lng),camera={cx:p.x,cy:p.y,zoom:2500};const next=photoLocationCamera(point,camera,metrics,'world'),s=toScreen(p,next,metrics);expect(s.y).toBeCloseTo(metrics.offY+metrics.sheetH*.2,6);expect(mapCoordinate(s.x,s.y,next,metrics,'world')!.lat).toBeCloseTo(point.lat,9);
 });
});
