/** The six fixed places the frog can stand inside the home. */
export const FROG_PERCHES = [
  'armchair',
  'fireplace-rug',
  'curio',
  'bookshelf',
  'suitcase',
  'footstool',
] as const;

export type FrogPerch = (typeof FROG_PERCHES)[number];

export const PERCH_LABELS: Readonly<Record<FrogPerch, string>> = {
  armchair: '扶手椅一角',
  'fireplace-rug': '壁炉前地毯上',
  curio: '多宝阁前',
  bookshelf: '明信片墙下矮书架边',
  suitcase: '敞开的行李箱边',
  footstool: '落地灯旁脚凳上',
};

/** Displays the frog can be asked to look at by clicking them. */
export type HomeDisplay = 'map' | 'postcard-wall' | 'curio' | 'fireplace' | 'bookshelf' | 'suitcase' | 'lamp';

export const DISPLAY_PERCH: Readonly<Record<HomeDisplay, FrogPerch>> = {
  map: 'armchair',
  'postcard-wall': 'bookshelf',
  bookshelf: 'bookshelf',
  curio: 'curio',
  fireplace: 'fireplace-rug',
  suitcase: 'suitcase',
  lamp: 'footstool',
};

export function isFrogPerch(value: unknown): value is FrogPerch {
  return typeof value === 'string' && (FROG_PERCHES as readonly string[]).includes(value);
}

export function nextPerch(current: FrogPerch): FrogPerch {
  const index = FROG_PERCHES.indexOf(current);
  return FROG_PERCHES[(index + 1) % FROG_PERCHES.length] ?? FROG_PERCHES[0];
}

export function perchForDisplay(display: HomeDisplay): FrogPerch {
  return DISPLAY_PERCH[display];
}

/** Maps a random number in [0, 1) to a perch, keeping the choice deterministic in tests. */
export function perchFromRandom(value: number): FrogPerch {
  const normalized = Number.isFinite(value) ? Math.min(0.999999, Math.max(0, value)) : 0;
  const index = Math.floor(normalized * FROG_PERCHES.length);
  return FROG_PERCHES[index] ?? FROG_PERCHES[0];
}
