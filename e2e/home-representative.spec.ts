import {test,expect} from '@playwright/test';
// Fresh synthetic archive only; the product code and default furniture are unchanged.
test('representative default home with frog and travel postcards',async({page},info)=>{
 await page.route('https://**/*',r=>r.abort('blockedbyclient'));
 await page.goto('/');
 await expect(page.getByRole('button',{name:'回家',exact:true})).toBeVisible();
 await page.evaluate(async()=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('travel-frog');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  const locations=[{name:'京都',countryCode:'JPN',countryName:'日本',lat:35.0116,lng:135.7681},{name:'里斯本',countryCode:'PRT',countryName:'葡萄牙',lat:38.7223,lng:-9.1393},{name:'雷克雅未克',countryCode:'ISL',countryName:'冰岛',lat:64.1466,lng:-21.9426}];
  try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('wishes','readwrite');locations.forEach((c,i)=>{const at=Date.UTC(2026,10,20,8+i),{lat,lng,...city}=c;tx.objectStore('wishes').put({id:`synthetic-home-letter-${i}`,cityRef:{...city,key:`${c.countryCode}:${c.name}`,centroid:{lat,lng,accuracyM:null,source:'candidate',approximate:true},source:'gazetteer',confidence:'high'},region:c.countryName,note:'示例旅行来信：愿你也看见这一路的风景。',status:i===0?'received':'stamped',source:'frog',from:null,origin:'demo',createdAt:at,updatedAt:at,deliveredAt:at});});tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}finally{db.close();}
 });
 await page.reload();
 await page.getByRole('button',{name:'回家',exact:true}).click();
 await expect(page.locator('.home-room')).toHaveAttribute('data-furniture','base');
 await expect(page.locator('.home-room')).toHaveAttribute('data-frog-away','false');
 await expect(page.locator('.home-frog')).toBeVisible();
 await expect(page.getByRole('group',{name:'明信片板'}).getByRole('button')).toHaveCount(3);
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(Array.from(document.images).map(i=>i.decode().catch(()=>{})));});
 // Wait for the real product's background artwork to decode, without replacing it.
 await page.locator('.home-scene').first().evaluate(async el=>{const src=getComputedStyle(el).backgroundImage.slice(5,-2);const img=new Image();img.src=src;await img.decode();});
 const path=info.outputPath('travel-frog-default-home.png');
 await page.screenshot({path,fullPage:true});
 await info.attach('default home · synthetic travel letters',{path,contentType:'image/png'});
});
