import type {Map as NativeMap} from 'maplibre-gl';
/** Read-only diagnostics for a settled native frame; no archive/photo payload. */
export function basemapFrame(map:NativeMap) {
  const features=map.queryRenderedFeatures(),center=map.getCenter(),container=map.getContainer();
  const layer=(feature:typeof features[number])=>String(('source-layer' in feature.layer?feature.layer['source-layer']:null)??feature.layer.id);
  const labels=features.filter(f=>f.layer.type==='symbol'&&f.layer.layout?.['text-field']);
  return {center:{lat:center.lat,lng:center.lng},zoom:map.getZoom(),bearing:map.getBearing(),pitch:map.getPitch(),width:container.clientWidth,height:container.clientHeight,
    features:features.length,roads:features.filter(f=>/street|road|transportation/.test(layer(f))).length,boundaries:features.filter(f=>/boundar|admin/.test(layer(f))).length,buildings:features.filter(f=>/building/.test(layer(f))).length,labels:labels.length,
    names:[...new Set(labels.map(f=>f.properties?.['name:zh']??f.properties?.name_zh??f.properties?.name??f.properties?.name_en).filter((n):n is string=>typeof n==='string'&&!!n))].slice(0,16)};
}
