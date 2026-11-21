// @vitest-environment jsdom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,describe,it,expect} from 'vitest';
import {INITIAL_SNAPSHOT,type ArchiveSnapshot} from '../../application/snapshot';
import {createPhoto,type Photo} from '../../domain/photo/photo';
import {createTrip} from '../../domain/trip/trip';
import {createVisit} from '../../domain/visit/visit';
import {createWish} from '../../domain/wish/wish';
import type {Result} from '../../domain/common/result';
import {asImportBatchId} from '../../domain/common/ids';
import {makeGeoPoint} from '../../domain/geo/geo-point';
import {GazetteerCityResolver} from '../../infrastructure/geo/city-resolver';
import {buildWallModel} from './model';
import {postcardFootprints} from './postcard-photos';
import {WishFocus} from './Postcard';
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
let root:Root|undefined;
afterEach(async()=>{await act(()=>root?.unmount());root=undefined;document.body.innerHTML='';});
function value<T>(r:Result<T>):T{if(!r.ok)throw new Error(r.error.message);return r.value;}
const at=Date.UTC(2024,4,2),kyoto=new GazetteerCityResolver().resolveByName('京都')!;
function trip(id:string,start=at){return value(createTrip({id,title:`QA ${id}`,timeRange:{start,end:start+86400000},cityRefs:[kyoto],coverPhotoId:null,sourceCandidateId:null,origin:'user',createdAt:start}));}
function photo(id:string,lat:number,lng:number,time=at):Photo{return value(createPhoto({id,importBatchId:asImportBatchId('qa-postcard-model'),fileName:`QA-${id}.jpg`,mimeType:'image/jpeg',byteSize:100,contentHash:null,capturedAt:time,capturedAtSource:'exif-original',captureOffsetMinutes:0,offsetSource:'exif',originalCapturedAt:null,geo:value(makeGeoPoint({lat,lng,source:'exif',approximate:false})),locationSource:'exif',thumbRef:`thumb-${id}`,origin:'user',importedAt:time,issues:[]}));}
function archive():ArchiveSnapshot{
 const first=trip('first'),far={...photo('far-unvisited',47.6062,-122.3321),tripId:first.id};
 const letter=value(createWish({id:'kyoto-letter',cityRef:kyoto,region:null,note:'QA 京都来信，只展示有明确同城关联的足迹。',source:'user',origin:'user',now:at,status:'received'}));
 return {...INITIAL_SNAPSHOT,status:'ready',trips:[first],photos:[far],wishes:[letter]};
}
async function openLetter(snapshot:ArchiveSnapshot){
 const m=buildWallModel(snapshot),wish=m.wishes[0]!,photos=postcardFootprints(m,wish.cityKey);
 const host=document.createElement('div');document.body.append(host);root=createRoot(host);
 // Give every fixture thumbnail a usable URL: an accidentally selected remote
 // photo must fail provenance checks, not disappear because bytes are absent.
 await act(()=>root!.render(<WishFocus wish={wish} left={0} top={0} photos={photos.map(p=>({id:p.id,at:p.capturedAt}))} photoImage={id=>`blob:synthetic-${id}`} onChoose={()=>{}} busy={false} onClose={()=>{}}/>));
 return {m,host,photos};
}
describe('whole archive -> wall model -> postcard detail provenance',()=>{
 it('keeps distant no-visit photos out even when nearestRef groups them under the Kyoto letter',async()=>{
  const {m,host,photos}=await openLetter(archive());
  expect(m.photos[0]!.cityKey).toBe(kyoto.key); // Preserve general map grouping.
  expect(m.photos[0]!.inferred).toBe(false); // EXIF accuracy does not confirm a city.
  expect(m.photos[0]!.lat).toBe(47.6062);expect(m.visits).toEqual([]);
  expect(photos).toEqual([]);expect(host.querySelector('.wf-photos')).toBeNull();expect(host.querySelector('img')).toBeNull();expect(host.textContent).toContain('文字寄语');expect(host.textContent).toContain('QA 京都来信');
 });
 it('still finds a later confirmed Kyoto visit after an earlier matching trip without valid photos',async()=>{
  const initial=archive(),later=trip('later',at+2*86400000);
  const visit=value(createVisit({id:'kyoto-visit',tripId:later.id,sequence:0,cityRef:kyoto,displayName:'京都',timeRange:later.timeRange,geo:kyoto.centroid,locationSource:'manual',confidence:'high'}));
  const local={...photo('confirmed-kyoto',35.0116,135.7681,later.timeRange.start),tripId:later.id,visitId:visit.id};
  const {photos,host}=await openLetter({...initial,trips:[...initial.trips,later],visits:[visit],photos:[...initial.photos,local]});
  expect(photos.map(p=>p.id)).toEqual([local.id]);expect(host.querySelectorAll('img')).toHaveLength(1);expect(host.querySelector('img')!.getAttribute('data-footprint-photo')).toBe(local.id);
 });
 it('rejects a visit reference owned by a different trip even if its derived cityKey matches',async()=>{
  const initial=archive(),other=trip('other',at+2*86400000);
  const foreign=value(createVisit({id:'foreign-visit',tripId:other.id,sequence:0,cityRef:kyoto,displayName:'京都',timeRange:other.timeRange,geo:kyoto.centroid,locationSource:'manual',confidence:'high'}));
  const wrong={...initial.photos[0]!,visitId:foreign.id};
  const {m,photos,host}=await openLetter({...initial,trips:[...initial.trips,other],visits:[foreign],photos:[wrong]});
  expect(m.photos[0]!.cityKey).toBe(kyoto.key);expect(photos).toEqual([]);expect(host.querySelector('img')).toBeNull();
 });
});
