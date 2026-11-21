import type {StyleSpecification} from 'maplibre-gl';
/** MapLibre requires absolute sprite URLs even when the style is served locally. */
export function resolveSprites(style:StyleSpecification,styleUrl:string):StyleSpecification {
 if(!style.sprite)return style;
 return {...style,sprite:typeof style.sprite==='string'?new URL(style.sprite,styleUrl).href:style.sprite.map(sprite=>({...sprite,url:new URL(sprite.url,styleUrl).href}))};
}
