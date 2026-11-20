import {test,expect} from '@playwright/test';
test('unavailable real provider falls back visibly without disabling offline selection',async({page},info)=>{
  await page.route('https://**/*',route=>route.fulfill({status:403,body:'Synthetic provider failure'}));
  await page.goto('/');await page.getByRole('button',{name:'加载真实底图',exact:true}).click();
  await expect(page.locator('.basemap-controls')).toContainText('真实底图加载失败',{timeout:20000});
  await expect(page.locator('.live-basemap')).toHaveCount(0);await expect(page.locator('#worldSvg')).toBeVisible();
  await expect(page.getByRole('button',{name:'导入照片',exact:true})).toBeEnabled();await expect(page.getByRole('button',{name:'搜索地点',exact:true})).toBeEnabled();
  await info.attach('fallback',{body:await page.screenshot(),contentType:'image/png'});
});
