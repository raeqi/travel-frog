import { describe, expect, it } from 'vitest';
import { overlaps, placeLabels, placeWish, type PilePlacement } from './layout';
import {POSTCARD_MARK_SIZE} from './postcard-mark';
import type { Metrics } from './geometry';

const METRICS: Metrics = {
  boardW: 1200,
  boardH: 720,
  sheetW: 1200,
  sheetH: 720,
  offX: 0,
  offY: 0,
};

describe('postmark target collision bounds',()=>{
 it('uses its complete 44px hit area and avoids photo/pin/other-stamp rectangles',()=>{
  const obstacles=[{x:172,y:172,w:56,h:56},{x:230,y:170,w:36,h:36}],placed=[{x:130,y:220,w:44,h:44}];
  const p=placeWish({anchor:{x:200,y:200},width:POSTCARD_MARK_SIZE,height:POSTCARD_MARK_SIZE,piles:[],placed,frogRect:null,obstacles,metrics:METRICS});
  expect(p.rect).toEqual({x:p.cx-22,y:p.cy-22,w:44,h:44});for(const o of [...placed,...obstacles])expect(overlaps(p.rect,o)).toBe(false);
 });
});

function pile(cityKey: string, title: string, photoIds: string[], sx: number, sy: number): PilePlacement {
  return { cityKey, title, photoIds, sx, sy, year: 2025, long: title.length > 9 };
}

describe('city label placement', () => {
  it('carries the photo count and the trip year into every label', () => {
    const labels = placeLabels({
      piles: [pile('JPN:京都', '京都', ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9'], 200, 200)],
      wishRects: [],
      frogPos: null,
      metrics: METRICS,
      level: 'world',
      photoCount: 9,
    });
    expect(labels).toHaveLength(1);
    expect(labels[0]).toMatchObject({ name: '京都', year: 2025, count: 9, twoLine: false });
    expect(labels[0]?.w).toBeGreaterThanOrEqual(70);
    expect(labels[0]?.h).toBe(36);
  });

  it('never overlaps two labels or a postcard', () => {
    const labels = placeLabels({
      piles: [
        pile('JPN:京都', '京都', ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'], 260, 240),
        pile('JPN:大阪', '大阪', ['p9', 'p10', 'p11', 'p12', 'p13', 'p14', 'p15', 'p16'], 300, 260),
        pile('ISL:雷克雅未克', '雷克雅未克', ['p17', 'p18', 'p19', 'p20', 'p21', 'p22', 'p23', 'p24'], 700, 420),
      ],
      wishRects: [],
      frogPos: { x: 520, y: 520 },
      metrics: METRICS,
      level: 'world',
      photoCount: 24,
    });
    expect(labels.length).toBeGreaterThan(0);
    const rects = labels.map((label) => ({ x: label.x - 4, y: label.y - 2, w: label.w + 8, h: label.h + 4 }));
    for (let i = 0; i < rects.length; i += 1) {
      for (let j = i + 1; j < rects.length; j += 1) {
        expect(overlaps(rects[i]!, rects[j]!)).toBe(false);
      }
    }
  });

  it('uses a taller box for two-line names and hides labels at city level', () => {
    const labels = placeLabels({
      piles: [pile('JPN:京都', '京都·大阪·宇治奈良', ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'], 300, 300)],
      wishRects: [],
      frogPos: null,
      metrics: METRICS,
      level: 'world',
      photoCount: 8,
    });
    expect(labels[0]?.twoLine).toBe(true);
    expect(labels[0]?.h).toBe(48);

    expect(
      placeLabels({
        piles: [pile('JPN:京都', '京都', ['p1'], 300, 300)],
        wishRects: [],
        frogPos: null,
        metrics: METRICS,
        level: 'city',
        photoCount: 1,
      }),
    ).toEqual([]);
  });
});
