import {describe,it,expect} from 'vitest';
import type {StyleSpecification} from 'maplibre-gl';
import {resolveSprites} from './resolve-sprites';
describe('native style sprite URL contract',()=>{
 it('resolves bundled named sprites against the actual style URL, including a hosting subdirectory',()=>{
  const style:StyleSpecification={version:8,sources:{},layers:[],sprite:[{id:'base',url:'./base'}]};const resolved=resolveSprites(style,'https://example.test/app/basemaps/v9/style.json');
  expect(resolved.sprite).toEqual([{id:'base',url:'https://example.test/app/basemaps/v9/base'}]);expect(style.sprite).toEqual([{id:'base',url:'./base'}]);
 });
 it('preserves absolute external sprite URLs and styles without sprites',()=>{const style:StyleSpecification={version:8,sources:{},layers:[]};expect(resolveSprites(style,'https://example.test/style.json')).toBe(style);expect(resolveSprites({...style,sprite:'https://assets.example.test/icons'},'https://example.test/style.json').sprite).toBe('https://assets.example.test/icons');});
});
