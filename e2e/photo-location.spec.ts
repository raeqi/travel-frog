import {test,expect,type Page,type TestInfo} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const fixture=(name:string)=>fileURLToPath(new URL('./fixtures/'+name,import.meta.url));
const longName='qa-kyoto-'+('long-synthetic-filename-'.repeat(8))+'.jpg';
async function photos(page:Page){return page.evaluate(async()=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('travel-frog');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  try{return await new Promise<Record<string,any>[]>((resolve,reject)=>{const r=db.transaction('photos').objectStore('photos').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}finally{db.close();}
});}
async function importImages(page:Page,files:{name:string;mimeType:string;buffer:Buffer}[]){
  await page.getByRole('navigation',{name:'主操作'}).getByRole('button',{name:'导入照片',exact:true}).click();
  await page.locator('#wall-file-input').setInputFiles(files);
  await page.getByRole('button',{name:`导入 ${files.length} 个文件`,exact:true}).click();
  await expect.poll(async()=>(await photos(page)).length).toBe(files.length);
  await expect(page.getByText(new RegExp(`已保存 ${files.length} 条记录`))).toBeVisible();
}
async function fillList(page:Page){
  const drawer=page.getByRole('complementary',{name:'管理照片',exact:true});
  if(!await drawer.isVisible())await page.getByRole('button',{name:/^管理照片/}).click();
  await drawer.getByRole('tab',{name:/补位置/}).click();return drawer;
}
async function screenshot(page:Page,info:TestInfo,label:string){
  const path=info.outputPath(label+'.png');await page.screenshot({path,fullPage:true});await info.attach(label,{path,contentType:'image/png'});
}
async function boardPoint(page:Page){
  return page.locator('.board').evaluate(node=>{
    const r=node.getBoundingClientRect(),sheet=node.querySelector('.map-sheet')!.getBoundingClientRect();
    const picker=document.querySelector('.photo-location-picker')!.getBoundingClientRect();
    const box=node.querySelector('#worldSvg')!.getAttribute('viewBox')!.split(/[ ,]+/).map(Number);
    const x=Math.round(sheet.x+sheet.width*.57),y=Math.round(Math.min(sheet.y+sheet.height*.32,picker.y-40));
    if(y<sheet.y+10)throw new Error('Photo picker leaves no usable map area');
    return {x,y,lat:90-(box[1]!+(y-sheet.y)/sheet.height*box[3]!)/640*180,lng:(box[0]!+(x-sheet.x)/sheet.width*box[2]!)/1000*360-180,board:{x:r.x,y:r.y}};
  });
}
async function pickedCoordinates(page:Page,expected:{lat:number;lng:number}){
  const selected=await page.locator('form[aria-label="确认照片位置"]').evaluate(node=>({lat:Number(node.querySelector<HTMLInputElement>('input[name=lat]')!.value),lng:Number(node.querySelector<HTMLInputElement>('input[name=lng]')!.value)}));
  // SVG viewBox is serialized to six decimal paper units. The mouse uses integer
  // CSS pixels; compare to that precision, then require exact saved values.
  expect(selected.lat).toBeCloseTo(expected.lat,6);expect(selected.lng).toBeCloseTo(expected.lng,6);return selected;
}
async function expectActualImage(page:Page,id:string,color:number[]){
  const pin=page.locator(`[data-photo="${id}"]`);await expect(pin).toBeVisible();await expect(pin.locator('.img')).toHaveCSS('background-image',/blob:/);
  const digest=await pin.locator('.img').evaluate(async(node,photoId)=>{
    const url=getComputedStyle(node).backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1];if(!url)throw new Error('Photo pin has no image');
    const db=await new Promise<IDBDatabase>((res,rej)=>{const r=indexedDB.open('travel-frog');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
    const get=(store:string,key:string)=>new Promise<any>((res,rej)=>{const r=db.transaction(store).objectStore(store).get(key);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
    try{
      const photo=await get('photos',photoId),row=await get('blobs',photo.thumbRef);
      const hash=async(blob:Blob)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))).join(',');
      const rendered=await (await fetch(url)).blob(),a=await hash(rendered),b=await hash(row.blob);
      const img=new Image();img.src=url;await img.decode();const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;const ctx=canvas.getContext('2d')!;ctx.drawImage(img,0,0);
      const pixel=[...ctx.getImageData(Math.floor(canvas.width/2),Math.floor(canvas.height/2),1,1).data].slice(0,3);
      return {matches:a===b,hash:a,pixel};
    }finally{db.close();}
  },id);
  expect(digest.matches).toBe(true);digest.pixel.forEach((v,i)=>expect(Math.abs(v-color[i]!)).toBeLessThan(12));
  await expect.poll(async()=>page.evaluate(async(photoId)=>{const db=await new Promise<IDBDatabase>((res,rej)=>{const r=indexedDB.open('travel-frog');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});try{const get=(store:string,key:string)=>new Promise<any>((res,rej)=>{const r=db.transaction(store).objectStore(store).get(key);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});const p=await get('photos',photoId),v=await get('mapView','map');return v?.state?.level==='city'&&v?.state?.cityKey===p.manualCityRef?.key;}finally{db.close();}},id)).toBe(true);
  await pin.click();await expect(page.getByRole('region',{name:'回忆'})).toBeVisible();
  const index=await page.locator('.memory .pcell .img').evaluateAll(async(nodes,hash)=>{
    for(let i=0;i<nodes.length;i++){const url=getComputedStyle(nodes[i]!).backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1];if(!url)continue;const bytes=await(await fetch(url)).arrayBuffer();const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).join(',');if(digest===hash)return i;}return -1;
  },digest.hash);
  expect(index).toBeGreaterThanOrEqual(0);await page.locator('.memory .pcell').nth(index).click();
  const image=page.getByRole('img',{name:'放大的旅行照片'});await expect(image).toBeVisible();
  expect(await image.evaluate(async(img:HTMLImageElement)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await(await fetch(img.src)).arrayBuffer()))).join(','))).toBe(digest.hash);
}
test.beforeEach(async({page})=>{
  // Deterministic offline data/UI test. External provider availability is a separate acceptance job.
  await page.route('https://**/*',route=>route.abort('blockedbyclient'));
  await page.goto('/');await expect(page.getByRole('navigation',{name:'主操作'}).getByRole('button',{name:'导入照片',exact:true})).toBeVisible();
});
test('suggestion → Kyoto view → cancel restores scroll → pick → confirm → actual photo → refresh',async({page},info)=>{
  const extras=Array.from({length:8},(_,n)=>({name:`qa-extra-${n}.jpg`,mimeType:'image/jpeg',buffer:Buffer.concat([readFileSync(fixture('no-suggestion.jpg')),Buffer.from(`qa-extra-${n}`)])}));
  await importImages(page,[{name:'qa-anchor.jpg',mimeType:'image/jpeg',buffer:readFileSync(fixture('kyoto-anchor.jpg'))},...extras,{name:longName,mimeType:'image/jpeg',buffer:readFileSync(fixture('kyoto-no-gps.jpg'))}]);
  const before=await photos(page),target=before.find(p=>p.fileName===longName)!;expect(target.geo).toBeNull();
  const drawer=await fillList(page),row=drawer.locator(`[data-location-photo="${target.id}"]`);await expect(row).toHaveCount(1);await expect(row).toContainText('京都');
  expect(await row.evaluate(n=>n.scrollWidth-n.clientWidth)).toBeLessThanOrEqual(1);
  const font=await row.locator('strong').evaluate(n=>parseFloat(getComputedStyle(n).fontSize));expect(font).toBeGreaterThanOrEqual(14);
  const button=row.getByRole('button',{name:'在地图选位置',exact:true});await button.scrollIntoViewIfNeeded();const hit=await button.boundingBox();expect(hit!.height).toBeGreaterThanOrEqual(40);
  const scroll=await drawer.locator('.drawer-body').evaluate(n=>n.scrollTop);expect(scroll).toBeGreaterThanOrEqual(0);
  await screenshot(page,info,'single-row-long-name');
  const lastRow=drawer.locator('[data-location-photo]').last();await lastRow.getByRole('button',{name:'在地图选位置',exact:true}).scrollIntoViewIfNeeded();
  const lastScroll=await drawer.locator('.drawer-body').evaluate(n=>n.scrollTop);expect(lastScroll).toBeGreaterThan(0);
  await lastRow.getByRole('button',{name:'在地图选位置',exact:true}).click();await page.getByRole('button',{name:'取消，返回照片'}).click();
  expect(await drawer.locator('.drawer-body').evaluate(n=>n.scrollTop)).toBeCloseTo(lastScroll,0);expect(await photos(page)).toEqual(before);
  await button.scrollIntoViewIfNeeded();const targetScroll=await drawer.locator('.drawer-body').evaluate(n=>n.scrollTop);await button.click();
  const picker=page.getByRole('region',{name:'给照片在地图选位置'});await expect(picker).toContainText('当前参考：京都');
  const view=await page.locator('#worldSvg').getAttribute('viewBox');const values=view!.split(/[ ,]+/).map(Number);expect((values[0]!+values[2]!/2)/1000*360-180).toBeCloseTo(135.7681,3);
  await expect(picker.locator('input[type=number]:visible')).toHaveCount(0);
  await picker.getByRole('button',{name:'取消，返回照片'}).click();await expect(drawer).toBeVisible();expect(await photos(page)).toEqual(before);expect(await drawer.locator('.drawer-body').evaluate(n=>n.scrollTop)).toBeCloseTo(targetScroll,0);
  await button.click();const chosen=await boardPoint(page);await page.mouse.click(chosen.x,chosen.y);await expect(picker.getByRole('textbox',{name:'照片地点名'})).toBeVisible();const selected=await pickedCoordinates(page,chosen);
  await picker.getByRole('textbox',{name:'照片地点名'}).fill('QA 京都河岸准确点');await screenshot(page,info,'kyoto-picked');await picker.getByRole('button',{name:'保存位置并继续'}).click();
  await expect.poll(async()=>(await photos(page)).find(p=>p.id===target.id)?.geo?.lat).toBe(selected.lat);
  const candidates=page.locator('.candidate').filter({hasText:'京都'});await expect(candidates).toHaveCount(1);await candidates.getByRole('button',{name:'确认并在地图查看',exact:true}).click();
  await expectActualImage(page,target.id,[230,30,180]);await screenshot(page,info,'actual-imported-photo');await page.reload();
  const after=await photos(page),saved=after.find(p=>p.id===target.id)!;expect(saved.manualCityRef.name).toBe('QA 京都河岸准确点');expect(saved.geo.lat).toBe(selected.lat);expect(saved.geo.lng).toBe(selected.lng);const anchor=before.find(p=>p.fileName==='qa-anchor.jpg')!;const kept=after.find(p=>p.id===anchor.id)!;expect({geo:kept.geo,thumbRef:kept.thumbRef,capturedAt:kept.capturedAt,contentHash:kept.contentHash}).toEqual({geo:anchor.geo,thumbRef:anchor.thumbRef,capturedAt:anchor.capturedAt,contentHash:anchor.contentHash});
  await expectActualImage(page,target.id,[230,30,180]);
});
test('archived without suggestion → city search → drag does not select → save retains ID and existing photo',async({page},info)=>{
  await importImages(page,[{name:'qa-anchor.jpg',mimeType:'image/jpeg',buffer:readFileSync(fixture('kyoto-anchor.jpg'))},{name:'qa-no-suggestion.jpg',mimeType:'image/jpeg',buffer:readFileSync(fixture('no-suggestion.jpg'))}]);
  await page.getByRole('tab',{name:/候选/}).click();await page.getByRole('button',{name:'确认并在地图查看',exact:true}).click();await expect(page.getByRole('complementary',{name:'管理照片',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:/^管理照片/}).click();await page.getByRole('tab',{name:/候选/}).click();await page.getByRole('button',{name:'先存入档案（暂不上图）',exact:true}).click();
  await expect.poll(async()=>(await photos(page)).find(p=>p.fileName==='qa-no-suggestion.jpg')?.tripId).toBeTruthy();
  const before=await photos(page),target=before.find(p=>p.fileName==='qa-no-suggestion.jpg')!,untouched=before.find(p=>p.fileName==='qa-anchor.jpg')!;expect(target.tripId).toBeTruthy();
  const drawer=await fillList(page),row=drawer.locator(`[data-location-photo="${target.id}"]`);await expect(row).toContainText('没有自动建议');await row.getByRole('button',{name:'在地图选位置',exact:true}).click();
  const picker=page.getByRole('region',{name:'给照片在地图选位置'});await expect(picker).not.toContainText('当前参考');
  await picker.getByRole('textbox',{name:'搜索照片拍摄城市'}).fill('京都');await picker.getByRole('button',{name:/查看京都附近/}).click();await expect(picker.getByRole('button',{name:'保存位置并继续'})).toHaveCount(0);
  const p=await boardPoint(page);await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+50,p.y+10,{steps:8});await page.mouse.up();await expect(picker.getByRole('textbox',{name:'照片地点名'})).toHaveCount(0);
  // A new deliberate press, rather than the drag's trailing click, selects the exact point.
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  const chosen=await boardPoint(page);await page.mouse.click(chosen.x,chosen.y);const selected=await pickedCoordinates(page,chosen);await picker.getByRole('textbox',{name:'照片地点名'}).fill('QA 无建议也可保存');await picker.getByRole('button',{name:'保存位置并继续'}).click();
  await expectActualImage(page,target.id,[15,75,220]);await screenshot(page,info,'archived-photo-after-location');await page.reload();const after=await photos(page);expect(after).toHaveLength(2);expect(after.find(p=>p.id===untouched.id)).toEqual(untouched);expect(after.find(p=>p.id===target.id)?.geo?.lat).toBe(selected.lat);await expectActualImage(page,target.id,[15,75,220]);
});

test('loaded POI click continues photo selection; one Escape cancels; normal click opens details',async({page},info)=>{
  await page.route('https://en.wikipedia.org/w/api.php?*',route=>route.fulfill({json:{batchcomplete:'',query:{pages:{'999':{pageid:999,ns:0,title:'QA Kyoto place',coordinates:[{lat:35.0116,lon:135.7681,globe:'earth',primary:''}],langlinks:[{lang:'zh','*':'QA 京都测试地点'}]}}}}}));
  await importImages(page,[{name:'qa-no-suggestion.jpg',mimeType:'image/jpeg',buffer:readFileSync(fixture('no-suggestion.jpg'))},{name:'qa-anchor.jpg',mimeType:'image/jpeg',buffer:readFileSync(fixture('kyoto-anchor.jpg'))}]);
  await page.getByRole('tab',{name:/候选/}).click();await page.getByRole('button',{name:'确认并在地图查看',exact:true}).click();await expect(page.getByRole('complementary',{name:'管理照片',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'搜索地点',exact:true}).click();
  const search=page.getByRole('region',{name:'搜索地点',exact:true});await search.locator('.palette-input input').fill('京都');await search.getByRole('button',{name:/京都.*查看城市附近/}).click();
  await page.getByRole('button',{name:'搜索地点',exact:true}).click();await search.getByRole('tab',{name:'附近真实地点'}).click();await search.getByRole('button',{name:'查询当前区域'}).click();await expect(search).toContainText('QA 京都测试地点');await search.getByRole('button',{name:'关闭搜索地点'}).click();
  const before=await photos(page);const drawer=await fillList(page);await drawer.getByRole('button',{name:'在地图选位置',exact:true}).click();
  const board=page.locator('.board'),pin=page.getByRole('button',{name:'地点：QA 京都测试地点',exact:true});await expect(pin).toBeVisible();
  for(let i=0;i<5;i++){
    const hit=await pin.evaluate(node=>{const b=node.getBoundingClientRect();return document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)?.closest('button')===node;});if(hit)break;
    await board.focus();await board.press('ArrowDown');await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  }
  await pin.click();
  const picker=page.getByRole('region',{name:'给照片在地图选位置'});await expect(picker.getByRole('textbox',{name:'照片地点名'})).toHaveValue('QA 京都测试地点');await expect(search).toHaveCount(0);await screenshot(page,info,'poi-in-current-photo-flow');
  await page.keyboard.press('Escape');await expect(picker).toHaveCount(0);await expect(drawer).toBeVisible();expect(await photos(page)).toEqual(before);
  await page.getByRole('button',{name:'关闭管理照片'}).click();await pin.click();await expect(page.getByRole('region',{name:'地点详情',exact:true})).toContainText('QA 京都测试地点');
});
