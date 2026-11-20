/// <reference types="node" />
import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {BrowserExifReader} from '../infrastructure/exif/exif-reader.browser';
import {GazetteerCityResolver} from '../infrastructure/geo/city-resolver';
import {suggestLocations} from '../domain/services/fill-locations';
import {DEFAULT_SPLIT_CONFIG} from '../domain/services/split-trips';
import type {Photo} from '../domain/photo/photo';
describe('browser synthetic fixtures exercise real EXIF and suggestion paths',()=>{
 it('decodes Kyoto anchor and distinguishes same-day missing GPS from a genuinely suggestion-free photo',async()=>{
  const reader=new BrowserExifReader(),resolver=new GazetteerCityResolver();
  const decoded=await Promise.all(['kyoto-anchor.jpg','kyoto-no-gps.jpg','no-suggestion.jpg'].map(async(name)=>reader.read(new File([new Uint8Array(readFileSync(new URL('../../e2e/fixtures/'+name,import.meta.url)))],name,{type:'image/jpeg'}))));
  expect(decoded[0]!.geo!.lat).toBeCloseTo(35.0116,6);expect(decoded[0]!.geo!.lng).toBeCloseTo(135.7681,6);expect(decoded[1]!.geo).toBeNull();expect(decoded[2]!.geo).toBeNull();
  expect(decoded.every(d=>d.capturedAtSource==='exif-original')).toBe(true);expect(decoded[1]!.capturedAt!-decoded[0]!.capturedAt!).toBe(5*60000);
  const photos=decoded.map((d,i)=>({id:String(i),geo:d.geo,capturedAt:d.capturedAt,capturedAtSource:d.capturedAtSource,captureOffsetMinutes:d.offsetMinutes,ignored:false,visitId:null}) as Photo);
  const suggestions=suggestLocations({photos,config:DEFAULT_SPLIT_CONFIG,resolveCity:g=>resolver.resolve(g),defaultOffsetMinutes:540});
  expect(suggestions).toHaveLength(1);expect(suggestions[0]).toMatchObject({photoId:'1',reason:'same-day-gps',cityRef:{name:'京都'}});
 });
 it('keeps the live separate-batch fixture unlocated but close enough in time for the Kyoto suggestion',async()=>{
  const reader=new BrowserExifReader(),resolver=new GazetteerCityResolver();
  const decoded=await Promise.all(['kyoto-anchor.jpg','kyoto-next-day-no-gps.jpg'].map(async name=>reader.read(new File([new Uint8Array(readFileSync(new URL('../../e2e/fixtures/'+name,import.meta.url)))],name,{type:'image/jpeg'}))));
  expect(decoded[1]!.geo).toBeNull();expect(decoded[1]!.capturedAtSource).toBe('exif-original');expect(decoded[1]!.capturedAt!-decoded[0]!.capturedAt!).toBe(86400000+5*60000);
  const photos=decoded.map((d,i)=>({id:String(i),geo:d.geo,capturedAt:d.capturedAt,capturedAtSource:d.capturedAtSource,captureOffsetMinutes:d.offsetMinutes,ignored:false,visitId:null}) as Photo);
  expect(suggestLocations({photos,config:DEFAULT_SPLIT_CONFIG,resolveCity:g=>resolver.resolve(g),defaultOffsetMinutes:540})).toMatchObject([{photoId:'1',reason:'nearest-in-time',cityRef:{name:'京都'}}]);
 });
});
