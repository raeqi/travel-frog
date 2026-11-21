import {test,expect} from '@playwright/test';
test('unavailable real provider falls back visibly without disabling offline selection',async({page},info)=>{
  const intercepted:{url:string;status:number}[]=[];page.on('response',response=>{if(new URL(response.url()).hostname==='tiles.openfreemap.org')intercepted.push({url:response.url(),status:response.status()});});
  await page.route('https://**/*',route=>route.fulfill({status:403,body:'Synthetic provider failure'}));
  await page.goto('/');const webgl2=await page.evaluate(()=>{try{return !!document.createElement('canvas').getContext('webgl2');}catch{return false;}});await page.getByRole('button',{name:'加载真实底图',exact:true}).click();
  await expect(page.locator('.basemap-controls')).toContainText('真实底图加载失败',{timeout:20000});
  await expect(page.locator('.live-basemap')).toHaveCount(0);await expect(page.locator('#worldSvg')).toBeVisible();
  await expect(page.getByRole('navigation',{name:'主操作'}).getByRole('button',{name:'导入照片',exact:true})).toBeEnabled();await expect(page.getByRole('button',{name:'搜索地点',exact:true})).toBeEnabled();
  const controls=await page.locator('.basemap-controls').boundingBox(),frog=await page.getByRole('complementary',{name:'蛙蛙状态与动作'}).boundingBox();expect(controls!.y+controls!.height).toBeLessThanOrEqual(frog!.y);
  await page.getByRole('button',{name:'加载真实底图',exact:true}).click();await expect(page.locator('.basemap-controls')).toContainText('真实底图加载失败',{timeout:20000});
  await info.attach('basemap-capability-and-interceptions',{body:JSON.stringify({webgl2,intercepted,externalProviderNetworkTested:false,renderSuccessTested:false},null,2),contentType:'application/json'});
  await info.attach('fallback',{body:await page.screenshot(),contentType:'image/png'});
});
