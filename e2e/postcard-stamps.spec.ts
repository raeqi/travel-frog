import {test,expect,type Page,type TestInfo} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const note='QA 京都来信：沿着河边慢慢走，看见桥上的风。完整寄语应当只在打开明信片后出现。';
async function readPhotos(page:Page){return page.evaluate(async()=>{
 const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('travel-frog');r.onsuccess=()=>resolve(r.result);});try{return await new Promise<any[]>(resolve=>{const r=db.transaction('photos').objectStore('photos').getAll();r.onsuccess=()=>resolve(r.result);});}finally{db.close();}
});}
async function shot(page:Page,info:TestInfo,name:string){const path=info.outputPath(name+'.png');await page.screenshot({path,fullPage:true});await info.attach(name,{path,contentType:'image/png'});}
test('small stamp survives map drag, opens only matching real footprint, and stays text-only for missing bytes',async({page},info)=>{
 await page.route('https://**/*',r=>r.abort('blockedbyclient'));await page.goto('/');
 await page.getByRole('navigation',{name:'主操作'}).getByRole('button',{name:'导入照片',exact:true}).click();
 await page.locator('#wall-file-input').setInputFiles({name:'QA-postcard-kyoto.jpg',mimeType:'image/jpeg',buffer:readFileSync(fileURLToPath(new URL('./fixtures/kyoto-anchor.jpg',import.meta.url)))});
 await page.getByRole('button',{name:'导入 1 个文件',exact:true}).click();await expect(page.getByText(/已保存 1 条记录/)).toBeVisible();
 await page.getByRole('tab',{name:/候选/}).click();await page.getByRole('button',{name:'确认并在地图查看',exact:true}).click();
 await expect.poll(async()=>(await readPhotos(page))[0]?.tripId).toBeTruthy();const photo=(await readPhotos(page))[0];
 // Only fixture setup uses IDB writes, in this fresh synthetic-only context.
 // All stamp opening, dragging, closing and state choices use the actual UI.
 await page.evaluate(async({photoId,note})=>{
  const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('travel-frog');r.onsuccess=()=>resolve(r.result);});
  try{const get=(s:string,k:string)=>new Promise<any>(resolve=>{const r=db.transaction(s).objectStore(s).get(k);r.onsuccess=()=>resolve(r.result);});
   const p=await get('photos',photoId),v=await get('visits',p.visitId),at=Date.now()-10000;
   await new Promise<void>((resolve,reject)=>{const tx=db.transaction('wishes','readwrite');tx.objectStore('wishes').put({id:'qa-kyoto-postcard',cityRef:v.cityRef,region:null,note,status:'received',source:'user',from:null,origin:'user',createdAt:at,updatedAt:at,deliveredAt:at});tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});
  }finally{db.close();}
 },{photoId:photo.id,note});
 await expect.poll(async()=>page.evaluate(async()=>{const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('travel-frog');r.onsuccess=()=>resolve(r.result);});try{return await new Promise<string|undefined>(resolve=>{const r=db.transaction('mapView').objectStore('mapView').get('map');r.onsuccess=()=>resolve(r.result?.state?.level);});}finally{db.close();}})).toBe('city');
 await page.reload();const mark=page.locator('.postcard-mark[data-wish="qa-kyoto-postcard"]');await expect(mark).toBeVisible();await expect(mark).toHaveAccessibleName(/京都的明信片.*新来信/);
 const box=(await mark.boundingBox())!;expect(box.width).toBe(44);expect(box.height).toBe(44);await expect(mark).not.toContainText(note);
 const pin=(await page.locator(`[data-photo="${photo.id}"]`).boundingBox())!;
 const overlap=Math.max(0,Math.min(box.x+box.width,pin.x+pin.width)-Math.max(box.x,pin.x))*Math.max(0,Math.min(box.y+box.height,pin.y+pin.height)-Math.max(box.y,pin.y));expect(overlap).toBe(0);
 await shot(page,info,'small-postmark-beside-photo');
 const sheet=(await page.locator('.map-sheet').boundingBox())!,x=sheet.x+sheet.width*.86,y=sheet.y+sheet.height*.3;
 await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x-40,y+15,{steps:8});await page.mouse.up();await expect(page.getByRole('dialog',{name:'京都 的明信片背面'})).toHaveCount(0);
 await expect.poll(async()=>Math.abs((await mark.boundingBox())!.x-box.x)).toBeGreaterThan(5);await mark.click();
 const dialog=page.getByRole('dialog',{name:'京都 的明信片背面'});await expect(dialog).toContainText(note);await expect(dialog).toContainText('不是蛙蛙寄来的图片');const img=dialog.locator('img[data-footprint-photo]');await expect(img).toHaveCount(1);await expect(img).toHaveAttribute('data-footprint-photo',photo.id);await expect(img).toHaveAttribute('src',/^blob:/);
 const bytesMatch=await img.evaluate(async(n:HTMLImageElement,photoId)=>{
  const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('travel-frog');r.onsuccess=()=>resolve(r.result);});try{const get=(s:string,k:string)=>new Promise<any>(resolve=>{const r=db.transaction(s).objectStore(s).get(k);r.onsuccess=()=>resolve(r.result);}),p=await get('photos',photoId),b=await get('blobs',p.thumbRef);const digest=async(b:Blob)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await b.arrayBuffer()))).join(',');return await digest(await(await fetch(n.src)).blob())===await digest(b.blob);}finally{db.close();}
 },photo.id);expect(bytesMatch).toBe(true);
 const detailBox=(await dialog.locator('.wish-focus-card').boundingBox())!,vp=page.viewportSize()!;expect(detailBox.x).toBeGreaterThanOrEqual(0);expect(detailBox.y).toBeGreaterThanOrEqual(0);expect(detailBox.x+detailBox.width).toBeLessThanOrEqual(vp.width);expect(detailBox.y+detailBox.height).toBeLessThanOrEqual(vp.height);
 await shot(page,info,'opened-letter-user-footprint');await dialog.getByRole('button',{name:'留着',exact:true}).click();await expect(dialog).toHaveCount(0);
 await expect.poll(async()=>page.evaluate(async()=>{const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('travel-frog');r.onsuccess=()=>resolve(r.result);});try{return await new Promise<string>(resolve=>{const r=db.transaction('wishes').objectStore('wishes').get('qa-kyoto-postcard');r.onsuccess=()=>resolve(r.result.status);});}finally{db.close();}})).toMatch(/stamped|fulfilled/);
 // Simulate an old archive whose thumbnail reference survived but bytes did not.
 await page.evaluate(async key=>{const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('travel-frog');r.onsuccess=()=>resolve(r.result);});try{await new Promise<void>(resolve=>{const tx=db.transaction('blobs','readwrite');tx.objectStore('blobs').delete(key);tx.oncomplete=()=>resolve();});}finally{db.close();}},photo.thumbRef);
 await page.reload();await mark.click();await expect(dialog).toContainText(note);await expect(dialog.locator('.wf-photos')).toHaveCount(0);await expect(dialog.locator('img')).toHaveCount(0);await expect(dialog).toContainText('文字寄语');await shot(page,info,'letter-without-image-no-blank-frame');await dialog.getByRole('button',{name:'钉回明信片',exact:true}).click();await expect(dialog).toHaveCount(0);
});
