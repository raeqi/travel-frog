// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {ManualLocationForm} from './ManualLocationForm';
import {RepairPhoto} from './RepairPhotos';
import type {Photo} from '../../domain/photo/photo';
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
let root:Root|undefined;
afterEach(async()=>{await act(async()=>root?.unmount());root=undefined;document.body.innerHTML='';});
function mount(){const node=document.createElement('div');document.body.appendChild(node);root=createRoot(node);return node;}
describe('native import repair form submission',()=>{
 it('reads entered location values on submit, including zero coordinates, without depending on a pending React change event',async()=>{
  const node=mount(),save=vi.fn(async()=>{});
  await act(async()=>root!.render(<ManualLocationForm count={1} onSave={save} onCancel={()=>{}}/>));
  for(const [name,value] of Object.entries({name:'自定义海岸',country:'测试区域',lat:'0',lng:'2.295'}))node.querySelector<HTMLInputElement>(`input[name="${name}"]`)!.value=value;
  await act(async()=>node.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  expect(save).toHaveBeenCalledWith({name:'自定义海岸',country:'测试区域',lat:0,lng:2.295});
 });
 it('keeps an absent EXIF time unknown until the explicit native date form is submitted',async()=>{
  const node=mount(),time=vi.fn(async()=>{});
  const photo={id:'synthetic',fileName:'QA.heic',thumbRef:'saved',capturedAtSource:'missing',tripId:null,geo:null} as Photo;
  await act(async()=>root!.render(<RepairPhoto photo={photo} onRetry={async()=>{}} onTime={time}/>));
  expect(time).not.toHaveBeenCalled();node.querySelector<HTMLInputElement>('input[type="datetime-local"]')!.value='2021-08-01T10:00';
  await act(async()=>node.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  expect(time).toHaveBeenCalledWith('synthetic',new Date('2021-08-01T10:00').getTime());
 });
});
