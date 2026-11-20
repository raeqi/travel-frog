import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./e2e',fullyParallel:false,workers:1,retries:0,timeout:45000,globalTimeout:10*60*1000,
  reporter:[['list'],['html',{open:'never'}]],
  use:{baseURL:'http://127.0.0.1:5173',locale:'zh-CN',timezoneId:'Asia/Tokyo',reducedMotion:'reduce',trace:'retain-on-failure',screenshot:'only-on-failure',launchOptions:{chromiumSandbox:true,ignoreDefaultArgs:['--enable-unsafe-swiftshader','--unsafely-disable-devtools-self-xss-warnings']}},
  projects:[{name:'desktop',use:{browserName:'chromium',viewport:{width:1280,height:800}}},{name:'short',use:{browserName:'chromium',viewport:{width:1280,height:600}}},{name:'narrow',use:{browserName:'chromium',viewport:{width:400,height:780}}}],
  webServer:{command:'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort',url:'http://127.0.0.1:5173',reuseExistingServer:false,env:{VITE_BASEMAP_MODE:'offline'}},
});
