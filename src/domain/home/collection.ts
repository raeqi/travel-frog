import type { CityRef } from '../city/city-ref';
import { domainError, err, ok, type Result } from '../common/result';
import type { Instant } from '../common/time';

export interface Specialty {
  readonly id: string;
  readonly cityKey: string;
  readonly name: string;
}

export interface SpecialtyAward {
  readonly specialtyId: string;
  readonly cityKey: string;
  readonly name: string;
  readonly tripId: string;
  readonly photoIds: readonly string[];
  readonly awardedAt: Instant;
}

export interface CityVisitEvidence {
  readonly city: CityRef;
  readonly tripId: string;
  readonly photoIds: readonly string[];
  readonly at: Instant;
}

const CATALOG: Readonly<Record<string, readonly string[]>> = {
  'CHN:哈尔滨': ['冰花玻璃杯'],
  'CHN:青岛': ['海边贝壳'],
  'CHN:成都': ['竹编茶垫'],
  'CHN:重庆': ['山城旅行牌'],
  'CHN:上海': ['城市线描书签'],
  'CHN:杭州': ['湖畔折扇'],
  'JPN:大阪': ['街巷旅行牌'],
  'JPN:宇治': ['茶碗'],
  'NOR:卑尔根': ['峡湾帆船'],
  'GRC:圣托里尼': ['蓝顶陶屋'],
  'JPN:京都': ['折扇', '京菓子'],
  'PRT:里斯本': ['瓷砖片', '法朵唱片'],
  'TUR:伊斯坦布尔': ['香料袋', '邪眼挂饰'],
  'ISL:雷克雅未克': ['黑石', '羊毛毯'],
  'THA:曼谷': ['小铜佛', '手编手环'],
  'MAR:舍夫沙万': ['蓝染布', '铜茶壶'],
  'FRA:巴黎': ['旧书签'],
  'ITA:罗马': ['大理石纹杯垫'],
  'ITA:佛罗伦萨': ['皮革书签'],
  'ITA:威尼斯': ['玻璃珠'],
  'ESP:巴塞罗那': ['高迪马赛克片'],
  'NLD:阿姆斯特丹': ['郁金香木鞋'],
  'CZE:布拉格': ['木偶'],
  'AUT:维也纳': ['乐谱页'],
  'CHE:苏黎世': ['牛铃'],
  'KOR:首尔': ['韩纸书签'],
  'SGP:新加坡': ['鱼尾狮摆件'],
  'USA:纽约': ['地铁票根'],
  'USA:旧金山': ['金门大桥书签'],
  'AUS:悉尼': ['海贝壳'],
};

function specialtyId(cityKey: string, name: string, index: number): string {
  return `${cityKey}:souvenir:${index}:${name}`;
}

/** Every city has one or two souvenirs. Unknown cities still receive one deterministic item. */
export function specialtiesForCity(city: CityRef): readonly Specialty[] {
  const names = CATALOG[city.key];
  if (names && names.length > 0) {
    return names.slice(0, 2).map((name, index) => ({
      id: specialtyId(city.key, name, index),
      cityKey: city.key,
      name,
    }));
  }
  const fallback = `${city.name}旅行牌`;
  return [{ id: specialtyId(city.key, fallback, 0), cityKey: city.key, name: fallback }];
}

export function specialtyIdsForCity(city: CityRef): ReadonlySet<string> {
  return new Set(specialtiesForCity(city).map((item) => item.id));
}

/**
 * Awards specialties for cities with at least one located photo. Records are append-only:
 * an already awarded souvenir keeps its original trip and photo evidence.
 */
export function collectSpecialtyAwards(
  existing: readonly SpecialtyAward[],
  evidence: readonly CityVisitEvidence[],
  now: Instant,
): SpecialtyAward[] {
  const known = new Set(existing.map((award) => award.specialtyId));
  const firstVisit = new Map<string, CityVisitEvidence>();
  for (const item of evidence) {
    if (item.photoIds.length === 0) continue;
    const current = firstVisit.get(item.city.key);
    if (!current || item.at < current.at) firstVisit.set(item.city.key, item);
  }

  const added: SpecialtyAward[] = [];
  for (const item of firstVisit.values()) {
    for (const specialty of specialtiesForCity(item.city)) {
      if (known.has(specialty.id)) continue;
      known.add(specialty.id);
      added.push({
        specialtyId: specialty.id,
        cityKey: specialty.cityKey,
        name: specialty.name,
        tripId: item.tripId,
        photoIds: [...item.photoIds],
        awardedAt: now,
      });
    }
  }
  return added.length === 0 ? [...existing] : [...existing, ...added];
}

export const CURIO_CAPACITY = 8;

export interface CurioSlot {
  readonly index: number;
  readonly specialty: SpecialtyAward | null;
}

export function curioSlots(awards: readonly SpecialtyAward[]): readonly CurioSlot[] {
  const slots: CurioSlot[] = [];
  for (let index = 0; index < CURIO_CAPACITY; index += 1) {
    slots.push({ index, specialty: awards[index] ?? null });
  }
  return slots;
}

/** Derived from specialities the archive has awarded; no new award is created by displaying. */
export function visibleSpecialties(awards: readonly SpecialtyAward[]): readonly SpecialtyAward[] {
  return awards.slice(0, CURIO_CAPACITY);
}

export type LuggageTier = 'small' | 'standard' | 'wardrobe';

export const LUGGAGE_LABELS: Readonly<Record<LuggageTier, string>> = {
  small: '小手提箱',
  standard: '标准旅行箱',
  wardrobe: '带外挂带与旅行贴纸的大衣柜箱',
};

/** Pure growth scale: <4 countries small, >=4 standard, >=8 wardrobe. */
export function luggageTier(countryCount: number): LuggageTier {
  if (countryCount >= 8) return 'wardrobe';
  if (countryCount >= 4) return 'standard';
  return 'small';
}

export type FurnitureStage = 'base' | 'settled' | 'collected';

export const FURNITURE_ITEMS = [
  'armchair',
  'rug',
  'postcard-wall',
  'map-table',
  'curio',
  'suitcase',
  'fireplace',
  'sideboard',
  'round-mirror',
  'bookshelf',
  'globe',
  'floor-lamp',
] as const;

export type FurnitureItem = (typeof FURNITURE_ITEMS)[number];

const BASE_ITEMS: readonly FurnitureItem[] = [
  'armchair',
  'rug',
  'postcard-wall',
  'map-table',
  'curio',
  'suitcase',
  'fireplace',
];

const SETTLED_ITEMS: readonly FurnitureItem[] = [...BASE_ITEMS, 'sideboard', 'round-mirror', 'bookshelf'];

const COLLECTED_ITEMS: readonly FurnitureItem[] = [...SETTLED_ITEMS, 'globe', 'floor-lamp'];

export function furnitureItemsForStage(stage: FurnitureStage): readonly FurnitureItem[] {
  if (stage === 'collected') return COLLECTED_ITEMS;
  if (stage === 'settled') return SETTLED_ITEMS;
  return BASE_ITEMS;
}

export function furnitureStage(tripCount: number, countryCount: number): FurnitureStage {
  if (countryCount >= 4 && tripCount >= 6) return 'collected';
  if (tripCount >= 3) return 'settled';
  return 'base';
}

export interface FurnitureState {
  readonly stage: FurnitureStage;
  readonly items: readonly FurnitureItem[];
  readonly fireplaceLit: boolean;
  readonly sideboard: boolean;
  readonly roundMirror: boolean;
  readonly bookshelf: boolean;
  readonly floorLampLit: boolean;
  readonly globe: boolean;
  readonly suitcaseFilled: boolean;
  readonly curioFilled: boolean;
}

export function furnitureFor(input: {
  readonly tripCount: number;
  readonly countryCount: number;
}): FurnitureState {
  const stage = furnitureStage(input.tripCount, input.countryCount);
  return {
    stage,
    items: furnitureItemsForStage(stage),
    fireplaceLit: stage !== 'base',
    sideboard: stage !== 'base',
    roundMirror: stage !== 'base',
    bookshelf: stage !== 'base',
    floorLampLit: stage === 'collected',
    globe: stage === 'collected',
    suitcaseFilled: stage !== 'base',
    curioFilled: stage === 'collected',
  };
}

export function validateSpecialtyAward(award: SpecialtyAward): Result<SpecialtyAward> {
  if (award.specialtyId.trim().length === 0 || award.cityKey.trim().length === 0) {
    return err(domainError('VALIDATION_FAILED', '特产记录缺少标识'));
  }
  if (award.name.trim().length === 0 || award.name.length > 40) {
    return err(domainError('VALIDATION_FAILED', '特产名称长度必须在 1–40 字符之间'));
  }
  if (award.tripId.trim().length === 0) {
    return err(domainError('VALIDATION_FAILED', '特产必须记录来源旅行'));
  }
  if (!Number.isFinite(award.awardedAt)) {
    return err(domainError('VALIDATION_FAILED', '特产获得时间无效'));
  }
  return ok(award);
}
