import {describe,it,expect} from 'vitest';
import {postcardFootprints} from './postcard-photos';
import type {WallModel,WallPhoto,WallVisit,WallTrip} from './model';
const photo=(id:string,cityKey='京都',tripId='trip-2',extra:Partial<WallPhoto>={}):WallPhoto=>({id,cityKey,tripId,lat:35,lng:135,capturedAt:10,palette:'city',thumbRef:`thumb-${id}`,origin:'user',inferred:false,...extra});
const visit=(id:string,photoIds:string[],extra:Partial<WallVisit>={}):WallVisit=>({id,photoIds,tripId:'trip-2',sequence:0,cityKey:'京都',name:'京都',countryName:'日本',lat:35,lng:135,start:1,end:20,...extra});
const trip=(id:string,photoIds:string[]):WallTrip=>({id,photoIds,title:id,year:2024,start:0,end:20,days:1,memory:null,cityKeys:['京都','大阪'],visits:[]});
function model(photos:WallPhoto[],visits:WallVisit[]=[],trips:WallTrip[]=[]):WallModel{return {photos,visits,trips,cities:[],wishes:[],noGpsCount:0,photoById:new Map(photos.map(p=>[p.id,p])),tripById:new Map(trips.map(t=>[t.id,t])),cityByKey:new Map(),wishById:new Map()};}
describe('postcard footprint provenance',()=>{
 it('does not take another city just because the first four trip photos belong to it',()=>{
  const other=Array.from({length:4},(_,i)=>photo(`osaka-${i}`,'大阪','trip-1'));
  const target=photo('kyoto','京都','trip-1');
  expect(postcardFootprints(model([...other,target],[visit('kyoto-visit',[...other.map(p=>p.id),target.id],{tripId:'trip-1'})],[trip('trip-1',[...other.map(p=>p.id),target.id])]),'京都').map(p=>p.id)).toEqual(['kyoto']);
 });
 it('searches later same-city trips when the first matching trip has no images',()=>{
  const p=photo('later');expect(postcardFootprints(model([p],[visit('later-visit',[p.id])],[trip('trip-1',[]),trip('trip-2',[p.id])]),'京都')).toEqual([p]);
 });
 it('orders confirmed same-city visits across trips and deduplicates before limiting',()=>{
  const explicit=photo('visit-photo','京都','trip-2',{capturedAt:20}),duplicate=photo('duplicate','京都','trip-2',{thumbRef:explicit.thumbRef}),fallback=photo('newer','京都','trip-3',{capturedAt:100}),wrong=photo('wrong','大阪');
  const m=model([fallback,explicit,duplicate,wrong],[visit('v',[wrong.id,explicit.id,explicit.id,duplicate.id,fallback.id]),visit('v-later-trip',[fallback.id],{tripId:'trip-3',start:0})]);
  expect(postcardFootprints(m,'京都').map(p=>p.id)).toEqual(['visit-photo','newer']);
 });
 it('does not substitute demo illustrations or missing personal thumbnails',()=>{
  const photos=[photo('demo','京都','trip-1',{origin:'demo'}),photo('missing','京都','trip-1',{thumbRef:null}),photo('other','大阪','trip-1')];
  expect(postcardFootprints(model(photos,[visit('v',photos.map(p=>p.id),{tripId:'trip-1'})]),'京都')).toEqual([]);
 });
 it('keeps later candidates available until actual image availability is known',()=>{
  const photos=Array.from({length:7},(_,i)=>photo(`p${i}`));expect(postcardFootprints(model(photos,[visit('v',photos.map(p=>p.id))]),'京都')).toHaveLength(7);
 });
 it('does not treat a grouping cityKey alone as confirmed footprint provenance',()=>{
  expect(postcardFootprints(model([photo('no-visit')]),'京都')).toEqual([]);
 });
});
