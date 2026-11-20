import type { StyleSpecification } from 'maplibre-gl';
export interface BasemapProvider { id:string; label:string; style:string|StyleSpecification }
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function basemapProvider(env:Record<string,string|undefined>):BasemapProvider {
  const raster=env.VITE_MAP_RASTER_URL;
  if(raster){
    const url=new URL(raster);
    if(url.protocol!=='https:'||url.hostname==='tile.openstreetmap.org'||url.hostname.endsWith('.tile.openstreetmap.org'))throw new Error('请配置有使用授权的 HTTPS 底图；OSM 标准公共瓦片不能作正式默认。');
    if(!env.VITE_MAP_ATTRIBUTION?.trim())throw new Error('自定义底图必须配置署名。');
    return {id:'configured-raster',label:env.VITE_MAP_LABEL||'已配置底图',style:{version:8,sources:{basemap:{type:'raster',tiles:[raster],tileSize:256,attribution:escape(env.VITE_MAP_ATTRIBUTION)}},layers:[{id:'basemap',type:'raster',source:'basemap'}]}};
  }
  const style=env.VITE_MAP_STYLE_URL||'https://tiles.openfreemap.org/styles/liberty';
  if(new URL(style).protocol!=='https:')throw new Error('底图样式须使用 HTTPS。');
  return {id:env.VITE_MAP_STYLE_URL?'configured-vector':'openfreemap',label:env.VITE_MAP_LABEL||'OpenFreeMap',style};
}
