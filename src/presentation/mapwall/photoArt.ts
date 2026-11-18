import { rng } from './geometry';

interface Palette {
  readonly sky: readonly [string, string];
  readonly sun: string;
  readonly far: string;
  readonly mid: string;
  readonly near: string;
  readonly accent: string;
  readonly water: string;
}

const PALETTES: Record<string, Palette> = {
  forest: { sky: ['#DCE7DA', '#93AE9C'], sun: '#F6E9C9', far: '#7C957F', mid: '#5C7A64', near: '#355346', accent: '#24382E', water: '#7FA394' },
  city: { sky: ['#EAE6DE', '#BDB7AB'], sun: '#F7EFD8', far: '#A8A297', mid: '#7E7A72', near: '#4A4B4C', accent: '#33363A', water: '#9AA6AA' },
  sea: { sky: ['#E2EDF2', '#9FC6D5'], sun: '#FBF3DA', far: '#7FA9B8', mid: '#4F8195', near: '#34596A', accent: '#243F4C', water: '#5E93A6' },
  snow: { sky: ['#EEF2F5', '#BAC8D3'], sun: '#FFFFFF', far: '#AEBECD', mid: '#7F94A6', near: '#5A6F80', accent: '#3F5261', water: '#8CA6B5' },
  sunset: { sky: ['#F7E7D2', '#E3A377'], sun: '#FFE1A8', far: '#C98B72', mid: '#9A6252', near: '#5F4038', accent: '#432C27', water: '#B57F6D' },
  temple: { sky: ['#F1E8D8', '#D8C3A2'], sun: '#F7E7C0', far: '#C3A77C', mid: '#96774F', near: '#5D4830', accent: '#3E2F1F', water: '#B5A184' },
  night: { sky: ['#2C3A4C', '#101722'], sun: '#E8E6D2', far: '#25344A', mid: '#1B2839', near: '#121C28', accent: '#0B1219', water: '#22364A' },
  field: { sky: ['#EFF0DF', '#C6D1A9'], sun: '#F9EDC6', far: '#B2BF8D', mid: '#8C9C68', near: '#61714A', accent: '#3F4B32', water: '#9BAF8A' },
  sakura: { sky: ['#FBEEE9', '#F2CBCD'], sun: '#FFF4E6', far: '#E3B8C0', mid: '#C98F9C', near: '#8E5F6C', accent: '#5E3E48', water: '#D8B3BA' },
  street: { sky: ['#EFE7DC', '#C8B9A6'], sun: '#F6E5C2', far: '#B09E88', mid: '#887660', near: '#544737', accent: '#372E23', water: '#A89682' },
};

export const PALETTE_NAMES = Object.keys(PALETTES);
export type PaletteName = keyof typeof PALETTES;

export function paletteFor(seed: number): PaletteName {
  return PALETTE_NAMES[seed % PALETTE_NAMES.length] ?? 'forest';
}

function enc(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Deterministic illustrated photo. No external files, no network. */
export function scene(seed: number, paletteName: PaletteName): string {
  const palette = PALETTES[paletteName] ?? PALETTES.forest!;
  const random = rng(seed);
  const unit = `g${seed % 100000}`;
  const night = paletteName === 'night';
  let kind = ['ridge', 'sea', 'city', 'temple', 'field', 'street'][Math.floor(random() * 6)] ?? 'ridge';
  if (paletteName === 'sea') kind = 'sea';
  if (paletteName === 'city' || paletteName === 'street') kind = random() > 0.5 ? 'city' : 'street';
  if (paletteName === 'temple') kind = 'temple';
  if (paletteName === 'sakura') kind = random() > 0.45 ? 'temple' : 'ridge';
  if (paletteName === 'snow') kind = random() > 0.5 ? 'sea' : 'ridge';

  let out = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240">`;
  out += '<defs>';
  out += `<linearGradient id="${unit}sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${palette.sky[0]}"/><stop offset="1" stop-color="${palette.sky[1]}"/></linearGradient>`;
  out += `<linearGradient id="${unit}w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${palette.water}"/><stop offset="1" stop-color="${palette.near}"/></linearGradient>`;
  out += '</defs>';
  out += `<rect width="320" height="240" fill="url(#${unit}sky)"/>`;

  const sunX = 40 + random() * 240;
  const sunY = 38 + random() * 46;
  const sunR = 12 + random() * 9;
  out += `<circle cx="${sunX.toFixed(1)}" cy="${sunY.toFixed(1)}" r="${sunR.toFixed(1)}" fill="${palette.sun}" opacity="${night ? '0.86' : '0.92'}"/>`;
  if (night) {
    for (let index = 0; index < 26; index += 1) {
      out += `<circle cx="${(random() * 320).toFixed(1)}" cy="${(random() * 120).toFixed(1)}" r="${(0.5 + random() * 0.9).toFixed(2)}" fill="#F4F1E2" opacity="${(0.25 + random() * 0.5).toFixed(2)}"/>`;
    }
  } else {
    for (let index = 0; index < 3; index += 1) {
      out += `<ellipse cx="${(random() * 320).toFixed(1)}" cy="${(30 + random() * 60).toFixed(1)}" rx="${(18 + random() * 26).toFixed(1)}" ry="${(5 + random() * 5).toFixed(1)}" fill="#FFFFFF" opacity="${(0.16 + random() * 0.16).toFixed(2)}"/>`;
    }
  }

  const ridge = (baseY: number, amp: number, color: string, opacity: number): string => {
    let d = `M0 240 L0 ${(baseY + random() * 8).toFixed(1)}`;
    let x = 0;
    while (x < 320) {
      const step = 34 + random() * 46;
      const y = baseY - amp * (0.35 + random() * 0.65);
      d += ` Q${(x + step / 2).toFixed(1)} ${y.toFixed(1)} ${(x + step).toFixed(1)} ${(baseY - amp * 0.15 * random()).toFixed(1)}`;
      x += step;
    }
    d += ' L320 240 Z';
    return `<path d="${d}" fill="${color}" opacity="${opacity}"/>`;
  };

  if (kind === 'ridge') {
    out += ridge(132, 46, palette.far, 0.75);
    out += ridge(158, 34, palette.mid, 0.92);
    for (let index = 0; index < 9; index += 1) {
      const x = random() * 320;
      const y = 150 + random() * 40;
      const h = 18 + random() * 26;
      out += `<path d="M${x.toFixed(1)} ${(y - h).toFixed(1)} l${(7 + random() * 5).toFixed(1)} ${h.toFixed(1)} h-${(14 + random() * 10).toFixed(1)} z" fill="${palette.near}" opacity="0.9"/>`;
    }
    out += `<rect y="196" width="320" height="44" fill="${palette.near}"/>`;
    out += `<rect y="196" width="320" height="18" fill="${palette.accent}" opacity="0.5"/>`;
  } else if (kind === 'sea') {
    out += `<rect y="128" width="320" height="112" fill="url(#${unit}w)"/>`;
    out += `<path d="M0 128 L60 122 L120 128 L190 118 L250 128 L320 121 L320 132 L0 132 Z" fill="${palette.far}" opacity="0.7"/>`;
    for (let index = 0; index < 9; index += 1) {
      const y = 140 + index * 10 + random() * 4;
      out += `<path d="M${(20 + random() * 40).toFixed(1)} ${y.toFixed(1)} h${(30 + random() * 60).toFixed(1)}" stroke="#FFFFFF" stroke-width="1" opacity="${(0.16 + random() * 0.18).toFixed(2)}"/>`;
    }
    if (random() > 0.45) {
      const bx = 40 + random() * 200;
      out += `<path d="M${bx.toFixed(1)} 150 l26 0 l-5 8 l-16 0 z" fill="${palette.accent}" opacity="0.85"/>`;
      out += `<path d="M${(bx + 13).toFixed(1)} 132 v18" stroke="${palette.accent}" stroke-width="2" opacity="0.85"/>`;
      out += `<path d="M${(bx + 13).toFixed(1)} 134 l14 14 h-14 z" fill="${palette.sun}" opacity="0.85"/>`;
    }
  } else if (kind === 'city') {
    out += `<rect y="150" width="320" height="90" fill="${palette.near}" opacity="0.35"/>`;
    let x = -10;
    while (x < 330) {
      const width = 18 + random() * 26;
      const height = 40 + random() * 92;
      out += `<rect x="${x.toFixed(1)}" y="${(196 - height).toFixed(1)}" width="${width.toFixed(1)}" height="${(height + 44).toFixed(1)}" fill="${random() > 0.5 ? palette.mid : palette.near}"/>`;
      if (random() > 0.4) {
        for (let wy = 0; wy < 3; wy += 1) {
          for (let wx = 0; wx < 2; wx += 1) {
            if (random() > 0.55) {
              out += `<rect x="${(x + 4 + wx * 9).toFixed(1)}" y="${(200 - height + 8 + wy * 12).toFixed(1)}" width="4" height="5" fill="${palette.sun}" opacity="${night ? '0.8' : '0.35'}"/>`;
            }
          }
        }
      }
      x += width + 3 + random() * 5;
    }
    out += `<rect y="196" width="320" height="44" fill="${palette.accent}"/>`;
    out += `<path d="M0 208 H320" stroke="${palette.sun}" stroke-width="1" opacity="0.25"/>`;
  } else if (kind === 'temple') {
    out += ridge(146, 26, palette.far, 0.6);
    const cx = 120 + random() * 90;
    const gy = 206;
    if (random() > 0.5) {
      out += `<g fill="${palette.accent}">`;
      out += `<rect x="${cx - 48}" y="${gy - 76}" width="96" height="7" rx="2"/>`;
      out += `<rect x="${cx - 40}" y="${gy - 62}" width="80" height="5" rx="2"/>`;
      out += `<rect x="${cx - 34}" y="${gy - 76}" width="7" height="76"/>`;
      out += `<rect x="${cx + 27}" y="${gy - 76}" width="7" height="76"/>`;
      out += '</g>';
    } else {
      out += `<g fill="${palette.accent}">`;
      for (let index = 0; index < 4; index += 1) {
        const width = 74 - index * 13;
        const y = gy - 16 - index * 30;
        out += `<path d="M${cx - width / 2} ${y} h${width} l-${width * 0.18} -10 h-${width * 0.64} z"/>`;
        out += `<rect x="${cx - width * 0.3}" y="${y - 26}" width="${width * 0.6}" height="18" fill="${palette.mid}"/>`;
      }
      out += '</g>';
    }
    out += `<rect y="206" width="320" height="34" fill="${palette.near}"/>`;
    for (let index = 0; index < 5; index += 1) {
      out += `<circle cx="${(30 + random() * 260).toFixed(1)}" cy="${(186 + random() * 20).toFixed(1)}" r="${(6 + random() * 10).toFixed(1)}" fill="${palette.far}" opacity="0.55"/>`;
    }
  } else if (kind === 'field') {
    out += ridge(140, 28, palette.far, 0.7);
    out += `<path d="M0 168 Q80 152 160 168 T320 164 V240 H0 Z" fill="${palette.mid}"/>`;
    out += `<path d="M0 196 Q90 184 170 198 T320 192 V240 H0 Z" fill="${palette.near}"/>`;
    for (let index = 0; index < 7; index += 1) {
      const x = 20 + random() * 280;
      const y = 176 + random() * 42;
      out += `<path d="M${x.toFixed(1)} ${y.toFixed(1)} l6 -10 l6 10 z" fill="${palette.accent}" opacity="0.55"/>`;
    }
    out += `<rect x="${(200 + random() * 60).toFixed(1)}" y="150" width="26" height="20" fill="${palette.accent}" opacity="0.75"/>`;
    out += `<path d="M198 150 l16 -12 l16 12 z" fill="${palette.accent}" opacity="0.8"/>`;
  } else {
    out += `<rect y="120" width="320" height="120" fill="${palette.mid}" opacity="0.55"/>`;
    out += `<path d="M120 240 L150 120 L172 120 L206 240 Z" fill="${palette.near}" opacity="0.9"/>`;
    out += `<path d="M0 196 H320" stroke="${palette.sun}" stroke-width="1.5" opacity="0.35"/>`;
    for (let index = 0; index < 5; index += 1) {
      const x = 6 + random() * 300;
      out += `<rect x="${x.toFixed(1)}" y="${(128 + random() * 24).toFixed(1)}" width="10" height="10" rx="5" fill="${palette.sun}" opacity="0.55"/>`;
    }
    out += `<rect x="0" y="208" width="320" height="32" fill="${palette.accent}" opacity="0.55"/>`;
  }

  out += `<radialGradient id="${unit}v" cx="0.5" cy="0.45" r="0.75"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.16"/></radialGradient>`;
  out += `<rect width="320" height="240" fill="url(#${unit}v)"/>`;
  out += '</svg>';
  return enc(out);
}
