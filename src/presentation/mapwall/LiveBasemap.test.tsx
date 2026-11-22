// @vitest-environment jsdom
import {afterEach,describe,it,expect,vi} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {LiveBasemap} from './LiveBasemap';
import {projectWorld,type Metrics} from './geometry';
const sdk=vi.hoisted(()=>({maps:[] as {options:Record<string,unknown>;events:Record<string,()=>void>;jumpTo:ReturnType<typeof vi.fn>;remove:ReturnType<typeof vi.fn>}[],fail:false,height:560}));
vi.mock('maplibre-gl',()=>({
 Map:class {
  events:Record<string,()=>void>={};jumpTo=vi.fn();remove=vi.fn();resize=vi.fn();setProjection=vi.fn();addControl=vi.fn();
  options:Record<string,unknown>;
  constructor(options:Record<string,unknown>){this.options=options;if(sdk.fail)throw new Error('WebGL unavailable');sdk.maps.push(this);}
  on(name:string,fn:()=>void){this.events[name]=fn;return this;}
  queryRenderedFeatures(){return [];}getCenter(){return {lng:135.7681,lat:35.0116};}getZoom(){return 12;}getBearing(){return 0;}getPitch(){return 0;}getContainer(){return {clientWidth:850,clientHeight:sdk.height};}
  getCanvas(){return document.createElement('canvas');}isStyleLoaded(){return true;}areTilesLoaded(){return true;}
 },AttributionControl:class {},setWorkerUrl:vi.fn()
}));
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
let root:Root|null=null;
afterEach(async()=>{await act(async()=>root?.unmount());root=null;sdk.maps=[];sdk.fail=false;sdk.height=560;vi.unstubAllGlobals();document.body.innerHTML='';});
const metrics:Metrics={boardW:1000,boardH:700,sheetW:850,sheetH:560,offX:70,offY:70,mercatorMode:'world'};
async function render(onFailure:()=>void,onReady:()=>void){
 vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});
 const host=document.createElement('div');document.body.append(host);root=createRoot(host);const point=projectWorld(35.0116,135.7681);
 await act(async()=>root!.render(<LiveBasemap camera={{cx:point.x,cy:point.y,zoom:2500}} metrics={metrics} mode="world" onFailure={onFailure} onReady={onReady}/>));return host;
}
describe('real renderer adapter lifecycle (mock SDK, not a browser render)',()=>{
 it('uses the public provider, leaves gestures with the wall, and reports readiness only after loaded tiles',async()=>{
  const failure=vi.fn(),ready=vi.fn(),host=await render(failure,ready),map=sdk.maps[0]!;
  expect(map.options).toMatchObject({style:'/basemaps/versatiles-9.1.0/style.json',interactive:false,renderWorldCopies:false});expect(map.options.center).toEqual([135.7681,expect.closeTo(35.0116,8)]);const edge={lng:178,lat:80};expect((map.options.transformConstrain as (center:unknown,zoom:number)=>unknown)(edge,1)).toEqual({center:edge,zoom:1});expect(ready).not.toHaveBeenCalled();await act(async()=>map.events.idle!());expect(host.querySelector('.live-basemap')!.getAttribute('data-loaded')).toBe('true');expect(ready).toHaveBeenCalledOnce();expect(failure).not.toHaveBeenCalled();
 });
 it('reports request errors once, allowing the owner to return to offline selection without retry loops',async()=>{
  const failure=vi.fn();await render(failure,vi.fn());const map=sdk.maps[0]!;await act(async()=>{map.events.error!();map.events.error!();});expect(failure).toHaveBeenCalledOnce();expect(sdk.maps).toHaveLength(1);
 });
 it('reports unavailable WebGL without taking down the archive',async()=>{sdk.fail=true;const failure=vi.fn();await render(failure,vi.fn());expect(failure).toHaveBeenCalledOnce();});
 it('does not call a zero-height native container ready',async()=>{sdk.height=0;const ready=vi.fn(),host=await render(vi.fn(),ready),map=sdk.maps[0]!;await act(async()=>map.events.idle!());expect(ready).not.toHaveBeenCalled();expect(host.querySelector('.live-basemap')!.getAttribute('data-loaded')).not.toBe('true');sdk.height=560;await act(async()=>map.events.idle!());expect(ready).toHaveBeenCalledOnce();});
});
