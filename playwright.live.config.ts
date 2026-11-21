import {defineConfig} from '@playwright/test';
const softwareGL=process.env.TRAVEL_FROG_CI_GL==='swangle';
export default defineConfig({
 testDir:'./e2e-live',workers:1,retries:0,timeout:120000,globalTimeout:6*60*1000,reporter:[['list'],['html',{open:'never',outputFolder:'playwright-live-report'}]],outputDir:'test-results-live',
 // Isolated acceptance branch: these two native cases visit the exact public
 // v24 Site. All imported pictures are synthetic, in clean browser contexts.
 use:{baseURL:'https://travel-frog-private-preview.dampcormorant10.chatgpt.site/',channel:'chromium',locale:'zh-CN',timezoneId:'Asia/Tokyo',reducedMotion:'reduce',trace:'retain-on-failure',screenshot:'only-on-failure',launchOptions:{chromiumSandbox:true,ignoreDefaultArgs:['--enable-unsafe-swiftshader','--unsafely-disable-devtools-self-xss-warnings'],args:softwareGL?['--use-gl=angle','--use-angle=swiftshader']:[]}},
 projects:[{name:'live-desktop',use:{viewport:{width:1440,height:1000}}},{name:'live-narrow',use:{viewport:{width:400,height:780}}}],
});
