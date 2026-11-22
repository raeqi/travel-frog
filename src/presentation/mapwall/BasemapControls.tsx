import './live-basemap.css';
export function BasemapControls({live,message,onToggle}:{live:boolean;message:string;onToggle:()=>void}) {
  return <section className="basemap-controls" aria-label="地图底图" data-map-controls><p role="status">{message}</p><button type="button" onClick={onToggle}>{live?'使用离线示意图':'加载真实底图'}</button></section>;
}
