// @vitest-environment jsdom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,describe,it,expect,vi} from 'vitest';
import {PostcardNode,WishFocus,type PlacedPostcard} from './Postcard';
import {POSTCARD_MARK_SIZE,POSTCARD_STATUS} from './postcard-mark';
import {MISSING_PHOTO} from './usePhotoImages';
import type {WallWish} from './model';
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
let root:Root|undefined;
afterEach(async()=>{await act(()=>root?.unmount());root=undefined;document.body.innerHTML='';});
function mount(){const host=document.createElement('div');document.body.append(host);root=createRoot(host);return host;}
const wish:WallWish={id:'letter',cityKey:'京都',name:'京都',region:null,countryName:'日本',status:'received',note:'这是完整寄语，不应在地图标记上铺开。',from:null,lat:35,lng:135,createdAt:1,deliveredAt:2};
function card(w:WallWish):PlacedPostcard{return {wish:w,cx:200,cy:200,width:POSTCARD_MARK_SIZE,height:POSTCARD_MARK_SIZE,arriving:false,dropping:false,flipping:false,flyX:0,flyY:0};}
describe('compact postcard map marker',()=>{
 it.each(['pending','received','opened','stamped','fulfilled'] as const)('retains %s state, accessible name and real 44px target without note text',async status=>{
  const host=mount(),click=vi.fn(),w={...wish,status};await act(()=>root!.render(<PostcardNode card={card(w)} now={5} highlighted={false} onClick={click}/>));
  const button=host.querySelector('button')!;expect(button.style.width).toBe('44px');expect(button.style.height).toBe('44px');expect(button.getAttribute('aria-label')).toContain(POSTCARD_STATUS[status]);expect(button.getAttribute('aria-label')).toContain('京都');expect(host.textContent).not.toContain(wish.note);expect(button.classList.contains(`st-${status}`)).toBe(true);await act(()=>button.click());expect(click).toHaveBeenCalledWith(w);
 });
});
describe('postcard detail uses only available footprint pictures',()=>{
 async function render(photoImage:(id:string)=>string|null,ids=['a','b','c','d','e']){const host=mount();await act(()=>root!.render(<WishFocus wish={wish} left={200} top={200} photos={ids.map(id=>({id,at:1}))} photoImage={photoImage} onChoose={()=>{}} busy={false} onClose={()=>{}}/>));return host;}
 it('is text-only with no images, null images or explicit missing artwork',async()=>{
  const host=await render(id=>id==='a'?MISSING_PHOTO:null);expect(host.querySelector('.wf-photos')).toBeNull();expect(host.querySelector('img')).toBeNull();expect(host.textContent).toContain(wish.note);expect(host.textContent).toContain('文字寄语');
 });
 it('filters unavailable early images before taking four and labels them as user footprints',async()=>{
  const host=await render(id=>id==='e'?'blob:real-user-photo':null);expect(host.querySelectorAll('.wf-photo')).toHaveLength(1);expect(host.querySelector('img')!.getAttribute('data-footprint-photo')).toBe('e');expect(host.textContent).toContain('不是蛙蛙寄来的图片');
 });
 it('removes broken images without a blank frame, allowing later usable photos into the limit',async()=>{
  const host=await render(id=>`blob:${id}`);expect(host.querySelectorAll('img')).toHaveLength(4);await act(()=>host.querySelector('img')!.dispatchEvent(new Event('error')));expect([...host.querySelectorAll('img')].map(i=>i.getAttribute('data-footprint-photo'))).toEqual(['b','c','d','e']);
  await act(()=>{for(const img of host.querySelectorAll('img'))img.dispatchEvent(new Event('error'));});expect(host.querySelector('.wf-photos')).toBeNull();expect(host.textContent).toContain(wish.note);
 });
 it('keeps the explicit keep/decline controls and closing behavior',async()=>{
  const host=mount(),choose=vi.fn(),close=vi.fn();await act(()=>root!.render(<WishFocus wish={wish} left={0} top={0} photos={[]} photoImage={()=>null} onChoose={choose} busy={false} onClose={close}/>));
  await act(()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='留着')!.click());expect(choose).toHaveBeenCalledWith(true);expect(close).not.toHaveBeenCalled();await act(()=>host.querySelector<HTMLButtonElement>('.wf-close')!.click());expect(close).toHaveBeenCalledOnce();
 });
});
