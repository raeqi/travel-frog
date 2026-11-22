import {useEffect,useLayoutEffect,useRef} from 'react';
import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
maplibregl.setWorkerUrl(workerUrl);
import 'maplibre-gl/dist/maplibre-gl.css';
import type {Camera,Metrics} from './geometry';
import {mercatorView,type ProjectionMode} from './mercator-camera';
import {basemapProvider} from './basemap-provider';
import {basemapFrame} from './basemap-frame';
import {resolveSprites} from './resolve-sprites';
import './live-basemap.css';
/** The existing wall owns input, data and camera; this adapter only renders geography. */
export function LiveBasemap({camera,metrics,mode,onFailure,onReady}:{camera:Camera;metrics:Metrics;mode:ProjectionMode;onFailure:()=>void;onReady:()=>void}) {
  const host=useRef<HTMLDivElement>(null),mapRef=useRef<maplibregl.Map|null>(null);
  const latest=useRef({camera,metrics,mode,onFailure,onReady});
  useLayoutEffect(()=>{latest.current={camera,metrics,mode,onFailure,onReady};});
  useEffect(()=>{
    const element=host.current;if(!element)return;
    let alive=true,failed=false,map:maplibregl.Map|undefined;
    const fail=()=>{if(alive&&!failed){failed=true;latest.current.onFailure();}};
    const timer=window.setTimeout(fail,15000);
    try {
      const provider=basemapProvider(import.meta.env);
      const initial=latest.current,view=mercatorView(initial.camera,initial.metrics,initial.mode);
      // Wall geometry owns the bounds; avoid SDK viewport constraints shifting the basemap under overlays.
      map=new maplibregl.Map({container:element,style:provider.style,transformStyle:(_previous,next)=>resolveSprites(next,typeof provider.style==='string'?new URL(provider.style,document.baseURI).href:document.baseURI),center:[view.center.lng,view.center.lat],zoom:view.zoom,bearing:0,pitch:0,minZoom:-2,maxZoom:22,interactive:false,renderWorldCopies:false,transformConstrain:(center,zoom)=>({center,zoom}),attributionControl:false,fadeDuration:0});
      mapRef.current=map;
      map.addControl(new maplibregl.AttributionControl({compact:false}),'bottom-right');
      element.querySelector('.maplibregl-control-container')?.setAttribute('data-map-controls','');
      map.on('style.load',()=>map?.setProjection({type:'mercator'}));
      map.on('error',fail);
      map.on('idle',()=>{if(alive&&!failed&&map?.isStyleLoaded()&&map.areTilesLoaded()){const frame=basemapFrame(map);if(frame.width<=0||frame.height<=0)return;element.dataset.frame=JSON.stringify(frame);element.dataset.loaded='true';window.clearTimeout(timer);latest.current.onReady();}});
      map.getCanvas().addEventListener('webglcontextlost',fail);
    } catch {fail();}
    const observer=new ResizeObserver(()=>{element.dataset.loaded='false';map?.resize();});observer.observe(element);
    return ()=>{alive=false;window.clearTimeout(timer);observer.disconnect();map?.remove();mapRef.current=null;};
  },[]);
  useLayoutEffect(()=>{
    const map=mapRef.current;if(!map||metrics.sheetW<=0)return;
    const view=mercatorView(camera,metrics,mode);
    if(host.current)host.current.dataset.loaded='false';
    map.jumpTo({center:[view.center.lng,view.center.lat],zoom:view.zoom,bearing:0,pitch:0});
  },[camera,metrics,mode]);
  return <div className="live-basemap" ref={host} aria-label="真实地理底图"/>;
}
