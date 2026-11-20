import {test,expect,type Page,type TestInfo} from '@playwright/test';
import {MercatorCoordinate} from 'maplibre-gl';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
type Frame={center:{lat:number;lng:number};zoom:number;width:number;height:number;features:number;roads:number;labels:number;boundaries:number;names:string[]};
async function nativeFrame(page:Page,point?:{lat:number;lng:number},streets=false,minZoom=-Infinity):Promise<Frame>{
 await expect.poll(async()=>{
  const node=page.locator('.live-basemap[data-loaded=true]');if(!await node.count())return false;
  const raw=await node.getAttribute('data-frame');if(!raw)return false;const f=JSON.parse(raw) as Frame;
  return f.features>0&&f.zoom>=minZoom&&(!point||(Math.abs(f.center.lat-point.lat)<.000001&&Math.abs(f.center.lng-point.lng)<.000001))&&(!streets||(f.roads>0&&f.labels>0));
 },{timeout:30000,message:'A current native frame with real geographic features must render; offline fallback is not a pass'}).toBe(true);
 return JSON.parse((await page.locator('.live-basemap').getAttribute('data-frame'))!) as Frame;
}
async function zoomToStreets(page:Page,point:{lat:number;lng:number}){
 let f=await nativeFrame(page,point);for(let i=0;i<6&&f.zoom<14;i++){const next=f.zoom+.9;await page.getByRole('button',{name:'放大',exact:true}).click();f=await nativeFrame(page,point,true,next);}expect(f.zoom).toBeGreaterThanOrEqual(14);return f;
}
async function record(page:Page,store:string,key?:string){return page.evaluate(async({store,key})=>{
 const db=await new Promise<IDBDatabase>((res,rej)=>{const r=indexedDB.open('travel-frog');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});try{return await new Promise<any>((res,rej)=>{const s=db.transaction(store).objectStore(store),r=key?s.get(key):s.getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}finally{db.close();}
},{store,key});}
async function importPhoto(page:Page,name:string,total:number){
 await page.getByRole('navigation',{name:'主操作'}).getByRole('button',{name:'导入照片',exact:true}).click();await page.locator('#wall-file-input').setInputFiles({name,mimeType:'image/jpeg',buffer:readFileSync(fileURLToPath(new URL('../e2e/fixtures/'+name,import.meta.url)))});
 await page.getByRole('button',{name:'导入 1 个文件',exact:true}).click();await expect(page.getByText(/已保存 1 条记录/)).toBeVisible();await expect.poll(async()=>(await record(page,'photos')).length).toBe(total);
}
async function shot(page:Page,info:TestInfo,name:string){const path=info.outputPath(name+'.png');await page.screenshot({path,fullPage:true});await info.attach(name,{path,contentType:'image/png'});}
function project(point:{lat:number;lng:number},f:Frame,rect:{x:number;y:number;width:number;height:number}){
 const center=MercatorCoordinate.fromLngLat(f.center),p=MercatorCoordinate.fromLngLat(point),size=512*2**f.zoom;
 return {x:rect.x+rect.width/2+(p.x-center.x)*size,y:rect.y+rect.height/2+(p.y-center.y)*size};
}
async function photoAlignment(page:Page,photo:any){
 const frame=await nativeFrame(page,photo.geo,true),rect=(await page.locator('.live-basemap').boundingBox())!,pin=page.locator(`[data-photo="${photo.id}"]`);await expect(pin).toBeVisible();
 const expected=project(photo.geo,frame,rect),box=(await pin.boundingBox())!;expect(Math.hypot(box.x+box.width/2-expected.x,box.y+box.height/2-expected.y)).toBeLessThan(2);
 await expect(pin.locator('.img')).toHaveCSS('background-image',/blob:/);return frame;
}
test('real streets, photo pick/save/refresh, POI routing and drag stay aligned',async({page},info)=>{
 const network:{url:string;status:number}[]=[],frames:{stage:string;frame:Frame}[]=[],consoleErrors:string[]=[];
 page.on('response',r=>{if(new URL(r.url()).hostname==='tiles.versatiles.org')network.push({url:r.url(),status:r.status()});});page.on('pageerror',e=>consoleErrors.push(e.message));
 // Only POI lookup is synthetic. All geographic tiles, glyphs and native rendering are real.
 let poi={lat:35.012,lng:135.769};await page.route('https://en.wikipedia.org/w/api.php?*',r=>r.fulfill({json:{batchcomplete:'',query:{pages:{'999':{pageid:999,ns:0,title:'QA Kyoto place',coordinates:[{lat:poi.lat,lon:poi.lng,globe:'earth',primary:''}],langlinks:[{lang:'zh','*':'QA 京都地图地点'}]}}}}}));
 try{
  await page.goto('/');const graphics=await page.evaluate(()=>{const gl=document.createElement('canvas').getContext('webgl2');if(!gl)return null;const ext=gl.getExtension('WEBGL_debug_renderer_info'),result={version:String(gl.getParameter(gl.VERSION)),renderer:String(gl.getParameter(ext?.UNMASKED_RENDERER_WEBGL??gl.RENDERER))};gl.getExtension('WEBGL_lose_context')?.loseContext();return result;});await info.attach('graphics',{body:JSON.stringify({graphics,softwareDriverRequested:process.env.TRAVEL_FROG_CI_GL,chromiumSandbox:true}),contentType:'application/json'});expect(graphics,'Real WebGL2 must be available').not.toBeNull();
  frames.push({stage:'world',frame:await nativeFrame(page)});await shot(page,info,'world-real-geography');
  await importPhoto(page,'kyoto-anchor.jpg',1);await page.getByRole('tab',{name:/候选/}).click();await page.getByRole('button',{name:'确认并在地图查看',exact:true}).click();
  const anchor=(await record(page,'photos'))[0];await zoomToStreets(page,anchor.geo);frames.push({stage:'kyoto-anchor',frame:await photoAlignment(page,anchor)});await shot(page,info,'kyoto-real-roads-and-photo');
  await page.getByRole('button',{name:'世界',exact:true}).click();let regional=await nativeFrame(page,{lat:-.5625,lng:0});for(let i=0;i<8&&regional.zoom<3;i++){const next=regional.zoom+.9;await page.getByRole('button',{name:'放大',exact:true}).click();regional=await nativeFrame(page,{lat:-.5625,lng:0},false,next);}expect(regional.zoom).toBeGreaterThanOrEqual(3);expect(regional.boundaries).toBeGreaterThan(0);expect(regional.labels).toBeGreaterThan(0);frames.push({stage:'regional-boundaries-labels',frame:regional});await shot(page,info,'regional-boundaries-labels');
  await importPhoto(page,'kyoto-no-gps.jpg',2);await page.getByRole('tab',{name:/补位置/}).click();const target=(await record(page,'photos')).find((p:any)=>p.fileName==='kyoto-no-gps.jpg');await page.locator(`[data-location-photo="${target.id}"]`).getByRole('button',{name:'在地图选位置',exact:true}).click();
  const picker=page.getByRole('region',{name:'给照片在地图选位置'});await expect(picker).toContainText('当前参考：京都');const f=await zoomToStreets(page,anchor.geo),rect=(await page.locator('.live-basemap').boundingBox())!,card=(await picker.boundingBox())!;
  const x=Math.round(rect.x+rect.width*.62),y=Math.round(Math.min(rect.y+rect.height*.25,card.y-35)),center=MercatorCoordinate.fromLngLat(f.center),size=512*2**f.zoom;
  const wanted=new MercatorCoordinate(center.x+(x-rect.x-rect.width/2)/size,center.y+(y-rect.y-rect.height/2)/size).toLngLat();await page.mouse.click(x,y);
  const selected=await picker.evaluate(n=>({lat:Number(n.querySelector<HTMLInputElement>('input[name=lat]')!.value),lng:Number(n.querySelector<HTMLInputElement>('input[name=lng]')!.value)}));expect(selected.lat).toBeCloseTo(wanted.lat,6);expect(selected.lng).toBeCloseTo(wanted.lng,6);await picker.getByRole('textbox',{name:'照片地点名'}).fill('QA 河岸精确位置');await shot(page,info,'photo-point-on-real-streets');await picker.getByRole('button',{name:'保存位置并继续'}).click();await page.getByRole('button',{name:'确认并在地图查看',exact:true}).click();
  const saved=await record(page,'photos',target.id);await zoomToStreets(page,saved.geo);expect({lat:saved.geo.lat,lng:saved.geo.lng}).toEqual(selected);frames.push({stage:'saved-photo',frame:await photoAlignment(page,saved)});await shot(page,info,'saved-photo-aligned-with-real-map');
  const pin=page.locator(`[data-photo="${target.id}"]`);const hash=await pin.locator('.img').evaluate(async n=>{const u=getComputedStyle(n).backgroundImage.match(/url\(["']?(.*?)["']?\)/)![1]!;return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await(await fetch(u)).arrayBuffer()))).join(',');});
  const expectedHash=await page.evaluate(async id=>{const db=await new Promise<IDBDatabase>(res=>{const r=indexedDB.open('travel-frog');r.onsuccess=()=>res(r.result);});try{const get=(s:string,k:string)=>new Promise<any>(res=>{const r=db.transaction(s).objectStore(s).get(k);r.onsuccess=()=>res(r.result);});const p=await get('photos',id),b=await get('blobs',p.thumbRef);return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await b.blob.arrayBuffer()))).join(',');}finally{db.close();}},target.id);expect(hash).toBe(expectedHash);
  await pin.click();await page.locator('.memory .pcell').first().click();const image=page.getByRole('img',{name:'放大的旅行照片'});await expect(image).toBeVisible();expect(await image.evaluate(async(img:HTMLImageElement)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await(await fetch(img.src)).arrayBuffer()))).join(','))).toBe(hash);await shot(page,info,'actual-photo-from-real-map');await page.getByRole('button',{name:'关闭大图'}).click();await page.getByRole('button',{name:'关闭回忆'}).click();
  await expect.poll(async()=>(await record(page,'mapView','map'))?.state?.cityKey).toBe(saved.manualCityRef.key);await page.reload();const restored=await record(page,'photos',target.id);expect(restored).toEqual(saved);expect(await record(page,'photos',anchor.id)).toEqual(anchor);frames.push({stage:'refreshed-photo',frame:await photoAlignment(page,restored)});
  poi={lat:selected.lat+.001,lng:selected.lng+.001};await page.getByRole('button',{name:'搜索地点',exact:true}).click();const search=page.getByRole('region',{name:'搜索地点',exact:true});await search.getByRole('tab',{name:'附近真实地点'}).click();await search.getByRole('button',{name:'查询当前区域'}).click();await expect(search).toContainText('QA 京都地图地点');await search.getByRole('button',{name:'关闭搜索地点'}).click();await page.getByRole('button',{name:'地点：QA 京都地图地点',exact:true}).click();await expect(page.getByRole('region',{name:'地点详情',exact:true})).toContainText('QA 京都地图地点');await search.getByRole('button',{name:'关闭搜索地点'}).click();
  const before=await nativeFrame(page),bounds=(await page.locator('.live-basemap').boundingBox())!,sx=Math.round(bounds.x+bounds.width*.86),sy=Math.round(bounds.y+bounds.height*.42);await page.mouse.move(sx,sy);await page.mouse.down();await page.mouse.move(sx-55,sy+20,{steps:8});await page.mouse.up();await expect.poll(async()=>{const a=await page.locator('.live-basemap').getAttribute('data-frame');return a?JSON.parse(a).center.lng:null;}).not.toBe(before.center.lng);frames.push({stage:'dragged-real-map',frame:await nativeFrame(page,undefined,true)});expect(await record(page,'photos',target.id)).toEqual(saved);await shot(page,info,'real-map-after-drag');
  expect(network.some(n=>n.status===200&&n.url.includes('/tiles/'))).toBe(true);expect(network.some(n=>n.status===200&&n.url.includes('/glyphs/'))).toBe(true);expect(network.filter(n=>n.status===429)).toEqual([]);expect(consoleErrors).toEqual([]);
 }finally{await info.attach('native-frames-and-network',{body:JSON.stringify({frames,network,consoleErrors,kind:'real-native-geography-with-synthetic-photos',poiLookup:'mocked',hardwareGPU:false},null,2),contentType:'application/json'});}
});
