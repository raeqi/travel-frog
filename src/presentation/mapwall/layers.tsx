import { WORLD_COUNTRIES } from '../../infrastructure/geo/world';
import { fnv1a } from './geometry';

interface LayerProps {
  readonly viewBox: string;
}

const GRATICULE_X: number[] = Array.from({ length: 13 }, (_, index) => (index * 1000) / 12);
const GRATICULE_Y: number[] = Array.from({ length: 11 }, (_, index) => 20 + index * 60);

export function WorldLayer({ viewBox, visitedCountries }: LayerProps & { readonly visitedCountries: ReadonlySet<string> }) {
  return (
    <svg id="worldSvg" className="map-layer" viewBox={viewBox} preserveAspectRatio="none" aria-hidden="true">
      <g className="grat">
        {GRATICULE_X.map((x) => (
          <path key={`gx-${x}`} vectorEffect="non-scaling-stroke" d={`M${x} 0V640`} />
        ))}
        {GRATICULE_Y.map((y) => (
          <path key={`gy-${y}`} vectorEffect="non-scaling-stroke" d={`M0 ${y}H1000`} />
        ))}
      </g>
      {WORLD_COUNTRIES.map((country) => {
        const visited = visitedCountries.has(country.name) || visitedCountries.has(country.id);
        const className = `land${visited ? ' is-visited' : ''}${country.id === 'JPN' ? ' is-focus' : ''}`;
        return <path key={country.id} className={className} d={country.d} />;
      })}
    </svg>
  );
}

const CITY_COLUMNS = [0, 92, 176, 264, 348, 436, 520, 604, 688, 776, 860, 944, 1000];
const CITY_ROWS = [0, 64, 128, 192, 256, 320, 384, 448, 512, 576, 640];

interface CityBlock {
  readonly key: string;
  readonly className: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly rx: number;
  readonly inner: { x: number; y: number; w: number; h: number } | null;
}

function cityBlocks(): CityBlock[] {
  const blocks: CityBlock[] = [];
  for (let row = 0; row < CITY_ROWS.length - 1; row += 1) {
    for (let column = 0; column < CITY_COLUMNS.length - 1; column += 1) {
      const hash = fnv1a(`blk${row}-${column}`);
      const inset = 4 + (hash % 4);
      const x = (CITY_COLUMNS[column] ?? 0) + inset;
      const y = (CITY_ROWS[row] ?? 0) + inset;
      const w = (CITY_COLUMNS[column + 1] ?? 0) - (CITY_COLUMNS[column] ?? 0) - inset * 2;
      const h = (CITY_ROWS[row + 1] ?? 0) - (CITY_ROWS[row] ?? 0) - inset * 2;
      if (w < 8 || h < 8) continue;
      let className = 'street-block';
      if ((hash >> 3) % 13 === 0) className += ' hollow';
      if ((hash >> 5) % 23 === 0) className = 'street-park';
      const inner =
        (hash >> 7) % 2 === 0 && h > 34
          ? { x: x + 4, y: y + 4, w: Math.max(5, w - 8), h: Math.round(h / 2 - 6) }
          : null;
      blocks.push({ key: `${row}-${column}`, className, x, y, w, h, rx: 1.5, inner });
    }
  }
  return blocks;
}

const CITY_BLOCKS = cityBlocks();

const CITY_ROADS = [
  { d: 'M0 320H1000', major: true },
  { d: 'M604 0V640', major: true },
  { d: 'M0 64H1000', major: false },
  { d: 'M0 192H1000', major: false },
  { d: 'M0 448H1000', major: false },
  { d: 'M0 576H1000', major: false },
  { d: 'M92 0V640', major: false },
  { d: 'M264 0V640', major: false },
  { d: 'M436 0V640', major: false },
  { d: 'M776 0V640', major: false },
  { d: 'M944 0V640', major: false },
];

const CITY_LABELS = [
  { x: 648, y: 470, text: '清水寺' },
  { x: 574, y: 412, text: '祇園' },
  { x: 762, y: 342, text: '南禅寺' },
  { x: 728, y: 188, text: '哲学之道', vertical: true },
  { x: 548, y: 196, text: '鴨川', vertical: true },
  { x: 26, y: 316, text: '四条通' },
  { x: 884, y: 86, text: '東山' },
];

export function CityLayer({ viewBox }: LayerProps) {
  return (
    <svg id="citySvg" className="map-layer" viewBox={viewBox} preserveAspectRatio="none" aria-hidden="true">
      <rect className="street-bg" x="0" y="0" width="1000" height="640" />
      <path className="street-hill" d="M828 -10 H1010 V650 H838 C826 548 848 452 838 356 C828 262 846 150 828 -10Z" />
      <path
        className="street-hill"
        opacity=".55"
        d="M640 -10 H705 C696 60 700 120 690 180 682 236 686 290 676 344 666 400 672 456 660 510 650 564 654 604 646 650 H632 C640 584 634 520 644 456 654 392 646 330 656 268 666 206 658 140 664 76 668 40 660 16 640 -10Z"
      />
      {CITY_BLOCKS.map((block) => (
        <g key={block.key}>
          <rect className={block.className} x={block.x} y={block.y} width={block.w} height={block.h} rx={block.rx} />
          {block.inner ? (
            <rect className="street-block hollow" x={block.inner.x} y={block.inner.y} width={block.inner.w} height={block.inner.h} rx="1" />
          ) : null}
        </g>
      ))}
      <path className="street-river" d="M556 -12C560 78 538 148 546 222S534 362 520 448 502 574 508 652" />
      <path className="street-river thin" opacity=".45" d="M300 -12C296 70 310 140 302 214S316 350 306 440 316 560 310 652" />
      {CITY_ROADS.map((road) => (
        <g key={road.d}>
          <path className={`street-road${road.major ? ' major' : ''} casing`} d={road.d} />
          <path className={`street-road${road.major ? ' major' : ''}`} d={road.d} />
        </g>
      ))}
      <path
        className="street-park"
        d="M712 196c-10 32 6 60-4 92s2 62-10 96"
        fill="none"
        stroke="rgba(74,106,74,.34)"
        strokeWidth="6"
        vectorEffect="non-scaling-stroke"
      />
      <circle className="street-park" cx="694" cy="244" r="16" />
      <circle className="street-park" cx="712" cy="332" r="13" />
      <rect className="street-park" x="640" y="404" width="52" height="38" rx="3" />
      <rect className="street-park" x="700" y="352" width="34" height="30" rx="3" />
      <circle cx="622" cy="440" r="3" fill="#A8573F" opacity=".75" />
      <circle cx="577" cy="377" r="3" fill="#A8573F" opacity=".75" />
      <circle cx="687" cy="320" r="3" fill="#A8573F" opacity=".75" />
      {CITY_LABELS.map((label) => (
        <text key={label.text} className={`street-label${label.vertical ? ' vert' : ''}`} x={label.x} y={label.y}>
          {label.text}
        </text>
      ))}
    </svg>
  );
}

const REGION_MINOR_ROADS = ['M0 120H1000', 'M0 330H1000', 'M0 520H1000', 'M180 0V640', 'M820 0V640', 'M360 0V640'];

const REGION_URBAN = [
  { x0: 592, y0: 170, cols: 4, rows: 3, w: 15, h: 12, gx: 5, gy: 5, rot: -5 },
  { x0: 428, y0: 372, cols: 5, rows: 4, w: 15, h: 11, gx: 5, gy: 6, rot: 7 },
  { x0: 642, y0: 288, cols: 2, rows: 2, w: 12, h: 9, gx: 4, gy: 4, rot: -4 },
];

function regionBlocks() {
  const out: { key: string; x: number; y: number; w: number; h: number; transform: string }[] = [];
  for (const [index, urb] of REGION_URBAN.entries()) {
    const ox = urb.x0 + (urb.cols * (urb.w + urb.gx)) / 2;
    const oy = urb.y0 + (urb.rows * (urb.h + urb.gy)) / 2;
    for (let row = 0; row < urb.rows; row += 1) {
      for (let column = 0; column < urb.cols; column += 1) {
        out.push({
          key: `${index}-${row}-${column}`,
          x: urb.x0 + column * (urb.w + urb.gx),
          y: urb.y0 + row * (urb.h + urb.gy),
          w: urb.w,
          h: urb.h,
          transform: `rotate(${urb.rot} ${ox} ${oy})`,
        });
      }
    }
  }
  return out;
}

const REGION_BLOCKS = regionBlocks();

export function RegionLayer({ viewBox }: LayerProps) {
  return (
    <svg id="streetSvg" className="map-layer" viewBox={viewBox} preserveAspectRatio="none" aria-hidden="true">
      <rect className="street-bg" x="0" y="0" width="1000" height="640" />
      <path d="M0 392C96 408 176 448 250 506 314 556 360 606 392 652L0 652Z" fill="rgba(84,122,140,.22)" />
      <path
        d="M0 392C96 408 176 448 250 506 314 556 360 606 392 652"
        fill="none"
        stroke="rgba(74,60,44,.30)"
        strokeWidth="1.4"
        vectorEffect="non-scaling-stroke"
      />
      <path className="street-hill" d="M560 -10H1010V300C930 322 844 300 774 254 704 208 660 150 628 92 606 52 586 20 560 -10Z" />
      <path className="street-hill" opacity=".55" d="M1000 430C920 424 860 452 812 500 772 540 746 588 730 650H1000Z" />
      <path className="street-hill" opacity=".7" d="M0 0H150C170 70 158 142 112 196 74 240 32 260 0 268Z" />
      <path className="street-hill" opacity=".45" d="M286 128C344 140 392 172 408 214 422 252 400 296 358 314 322 330 286 316 264 286 240 254 250 212 262 180 270 158 274 138 286 128Z" />
      <path className="street-hill" opacity=".38" d="M500 470C548 462 592 478 614 508 632 532 626 566 604 590 580 616 540 618 516 596 494 576 490 540 498 512 500 498 496 484 500 470Z" />
      <path className="street-river thin" opacity=".55" d="M628 214C640 248 626 282 606 310 586 338 540 372 498 396 476 408 462 414 452 420" />
      <path className="street-river thin" opacity=".4" d="M452 420C430 438 414 460 400 486 388 508 378 530 370 556" />
      {REGION_MINOR_ROADS.map((d) => (
        <g key={d}>
          <path className="street-road casing" d={d} />
          <path className="street-road" d={d} />
        </g>
      ))}
      <path className="street-road major casing" d="M636 219C641 246 650 274 656 298 620 335 540 380 470 418" />
      <path className="street-road major" d="M636 219C641 246 650 274 656 298 620 335 540 380 470 418" />
      <path className="street-road major casing" d="M470 418C410 458 340 486 268 504" />
      <path className="street-road major" d="M470 418C410 458 340 486 268 504" />
      <circle cx="636" cy="219" r="46" fill="rgba(92,70,48,.05)" />
      <circle cx="656" cy="298" r="30" fill="rgba(92,70,48,.05)" />
      <circle cx="470" cy="418" r="52" fill="rgba(92,70,48,.05)" />
      {REGION_BLOCKS.map((block) => (
        <rect
          key={block.key}
          className="street-block"
          x={block.x}
          y={block.y}
          width={block.w}
          height={block.h}
          rx=".8"
          transform={block.transform}
          opacity=".5"
        />
      ))}
      <circle cx="636" cy="219" r="3.4" fill="rgba(74,60,44,.62)" />
      <circle cx="656" cy="298" r="3.4" fill="rgba(74,60,44,.62)" />
      <circle cx="470" cy="418" r="3.4" fill="rgba(74,60,44,.62)" />
      <text className="street-label" x="820" y="176">比叡山</text>
      <text className="street-label" x="742" y="470">奈良</text>
      <text className="street-label" x="264" y="170">关西 · 京都 — 宇治 — 大阪</text>
    </svg>
  );
}
