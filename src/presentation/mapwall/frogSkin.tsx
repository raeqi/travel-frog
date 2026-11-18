import type { FrogPerch } from '../../domain/home/perch';

export type FrogPose = 'front' | 'side' | 'back' | 'sit' | 'sleep' | 'run' | 'lookup' | 'postcard' | 'packing';

export const PERCH_POSE: Readonly<Record<FrogPerch, FrogPose>> = {
  armchair: 'sit',
  'fireplace-rug': 'front',
  curio: 'lookup',
  bookshelf: 'side',
  suitcase: 'run',
  footstool: 'sleep',
};

const BODY = 'var(--frog-body)';
const BELLY = 'var(--frog-belly)';
const SCARF = 'var(--frog-scarf)';
const KNIT = 'var(--frog-scarf-deep)';
const EYE = 'var(--frog-eye)';
const PUPIL = 'var(--frog-pupil)';

function Eyes({ cx, cy, closed = false }: { readonly cx: number; readonly cy: number; readonly closed?: boolean }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r="13" fill={BODY} stroke={EYE} strokeWidth="2" />
      {closed ? (
        <path d={`M${cx - 6} ${cy} q6 4 12 0`} fill="none" stroke={EYE} strokeWidth="1.8" strokeLinecap="round" />
      ) : (
        <>
          <circle cx={cx} cy={cy + 1} r="7.2" fill={PUPIL} />
          <circle cx={cx + 2.4} cy={cy - 1.6} r="2.1" fill="#FFFdf8" />
        </>
      )}
    </g>
  );
}

function Scarf({ y, hang = true }: { readonly y: number; readonly hang?: boolean }) {
  return (
    <g>
      <path
        d={`M38 ${y - 8}c8-8 16-10 32-10s24 2 32 10c3 8-4 14-12 12-8-6-14-8-20-8s-12 2-20 8c-8 2-15-4-12-12z`}
        fill={SCARF}
      />
      <path
        d={`M52 ${y - 2}c10-5 16-6 28-6s18 1 28 6`}
        fill="none"
        stroke={KNIT}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      {hang ? (
        <>
          <path d={`M78 ${y + 4}c2 14 0 26-4 34`} fill="none" stroke={SCARF} strokeWidth="9" strokeLinecap="round" />
          <path d={`M96 ${y + 4}c2 12 4 22 8 30`} fill="none" stroke={SCARF} strokeWidth="8" strokeLinecap="round" />
        </>
      ) : null}
    </g>
  );
}

function Feet({ y }: { readonly y: number }) {
  return (
    <g>
      <ellipse cx="58" cy={y} rx="16" ry="8" fill={BODY} stroke={EYE} strokeWidth="1.4" />
      <ellipse cx="102" cy={y} rx="16" ry="8" fill={BODY} stroke={EYE} strokeWidth="1.4" />
      <path d={`M48 ${y}c-2 3-6 3-8 1M112 ${y}c2 3 6 3 8 1`} fill="none" stroke={EYE} strokeWidth="1.2" strokeLinecap="round" />
    </g>
  );
}

function Front({
  lookup = false,
  holding = null,
}: {
  readonly lookup?: boolean;
  readonly holding?: 'card' | 'case' | null;
}) {
  const eyeY = lookup ? 36 : 44;
  return (
    <g>
      <ellipse cx="80" cy="148" rx="36" ry="7" fill="rgba(30,24,16,.28)" />
      <Feet y={136} />
      <ellipse cx="80" cy="108" rx="34" ry="30" fill={BODY} stroke={EYE} strokeWidth="1.6" />
      <ellipse cx="80" cy="114" rx="20" ry="16" fill={BELLY} />
      <path d="M48 100c-14 6-18 18-10 24" fill="none" stroke={BODY} strokeWidth="9" strokeLinecap="round" />
      <path d="M112 100c14 6 18 18 10 24" fill="none" stroke={BODY} strokeWidth="9" strokeLinecap="round" />
      <path d="M40 120c3 2 6 1 7-1M120 120c-3 2-6 1-7-1" fill="none" stroke={EYE} strokeWidth="1.3" strokeLinecap="round" />
      <ellipse cx="80" cy="52" rx="34" ry="24" fill={BODY} stroke={EYE} strokeWidth="1.6" />
      <Eyes cx={58} cy={eyeY} />
      <Eyes cx={102} cy={eyeY} />
      <path d="M74 52c.6 1.4 0 2.2-.2 2.4M86 52c.6 1.4 0 2.2-.2 2.4" stroke={EYE} strokeWidth="1.3" strokeLinecap="round" />
      <path d="M68 62c4 5 20 5 24 0" fill="none" stroke={EYE} strokeWidth="1.8" strokeLinecap="round" />
      <Scarf y={80} />
      {holding === 'card' ? (
        <g transform="translate(112 78) rotate(-10)">
          <rect width="28" height="20" rx="1.5" fill="#F7F1E4" stroke={EYE} strokeWidth="1" />
          <circle cx="22" cy="5" r="2" fill="#B23A2E" />
        </g>
      ) : null}
      {holding === 'case' ? (
        <g transform="translate(114 108)">
          <rect y="6" width="22" height="16" rx="2" fill="#8A5A32" stroke="#5C3A1C" strokeWidth="1" />
          <path d="M6 6c0-5 10-5 10 0" fill="none" stroke="#5C3A1C" strokeWidth="1.6" />
        </g>
      ) : null}
    </g>
  );
}

function Sit() {
  return (
    <g>
      <ellipse cx="80" cy="146" rx="40" ry="7" fill="rgba(30,24,16,.28)" />
      <ellipse cx="48" cy="132" rx="18" ry="9" fill={BODY} stroke={EYE} strokeWidth="1.4" transform="rotate(-18 48 132)" />
      <ellipse cx="114" cy="132" rx="18" ry="9" fill={BODY} stroke={EYE} strokeWidth="1.4" transform="rotate(18 114 132)" />
      <ellipse cx="80" cy="108" rx="38" ry="28" fill={BODY} stroke={EYE} strokeWidth="1.6" />
      <ellipse cx="80" cy="114" rx="22" ry="16" fill={BELLY} />
      <path d="M46 100c-12 4-16 14-8 18" fill="none" stroke={BODY} strokeWidth="8" strokeLinecap="round" />
      <path d="M114 100c12 4 16 14 8 18" fill="none" stroke={BODY} strokeWidth="8" strokeLinecap="round" />
      <ellipse cx="80" cy="58" rx="32" ry="24" fill={BODY} stroke={EYE} strokeWidth="1.6" />
      <Eyes cx={58} cy={48} />
      <Eyes cx={102} cy={48} />
      <path d="M68 66c4 4 20 4 24 0" fill="none" stroke={EYE} strokeWidth="1.8" strokeLinecap="round" />
      <Scarf y={84} />
    </g>
  );
}

function Side() {
  return (
    <g>
      <ellipse cx="78" cy="146" rx="30" ry="6" fill="rgba(30,24,16,.28)" />
      <ellipse cx="58" cy="134" rx="14" ry="7" fill={BODY} stroke={EYE} strokeWidth="1.3" />
      <ellipse cx="96" cy="132" rx="13" ry="6.5" fill={BODY} stroke={EYE} strokeWidth="1.3" />
      <ellipse cx="78" cy="104" rx="32" ry="30" fill={BODY} stroke={EYE} strokeWidth="1.6" />
      <ellipse cx="86" cy="112" rx="16" ry="16" fill={BELLY} />
      <path d="M48 100c-10 6-12 16-4 18" fill="none" stroke={BODY} strokeWidth="8" strokeLinecap="round" />
      <ellipse cx="96" cy="62" rx="30" ry="26" fill={BODY} stroke={EYE} strokeWidth="1.6" />
      <Eyes cx={112} cy={50} />
      <path d="M96 72c6 4 16 3 18-2" fill="none" stroke={EYE} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M62 84c16-10 40-6 52 8 4 6-6 14-18 10-14-4-24-6-34-18z" fill={SCARF} />
      <path d="M78 96c2 16-2 28-8 36" fill="none" stroke={SCARF} strokeWidth="8" strokeLinecap="round" />
    </g>
  );
}

function Back() {
  return (
    <g>
      <ellipse cx="80" cy="146" rx="36" ry="6" fill="rgba(30,24,16,.28)" />
      <Feet y={134} />
      <ellipse cx="80" cy="104" rx="36" ry="32" fill={BODY} stroke={EYE} strokeWidth="1.6" />
      <ellipse cx="62" cy="70" rx="7" ry="6" fill="#A7B28C" />
      <ellipse cx="98" cy="74" rx="6" ry="5" fill="#A7B28C" />
      <ellipse cx="80" cy="58" rx="32" ry="24" fill={BODY} stroke={EYE} strokeWidth="1.6" />
      <circle cx="56" cy="46" r="9" fill={BODY} stroke={EYE} strokeWidth="1.5" />
      <circle cx="104" cy="46" r="9" fill={BODY} stroke={EYE} strokeWidth="1.5" />
      <Scarf y={82} />
    </g>
  );
}

function Sleep() {
  return (
    <g>
      <ellipse cx="80" cy="132" rx="42" ry="8" fill="rgba(30,24,16,.28)" />
      <ellipse cx="80" cy="100" rx="44" ry="34" fill={BODY} stroke={EYE} strokeWidth="1.6" />
      <ellipse cx="80" cy="108" rx="22" ry="16" fill={BELLY} />
      <path d="M48 86c12-12 52-12 64 0 4 8-8 16-32 16S44 94 48 86z" fill={SCARF} />
      <path d="M58 78q10 6 18 0" fill="none" stroke={EYE} strokeWidth="2" strokeLinecap="round" />
      <path d="M86 78q10 6 18 0" fill="none" stroke={EYE} strokeWidth="2" strokeLinecap="round" />
      <path d="M70 96c4 3 12 3 16 0" fill="none" stroke={EYE} strokeWidth="1.5" strokeLinecap="round" />
    </g>
  );
}

function Run() {
  return (
    <g transform="rotate(-14 80 90)">
      <ellipse cx="70" cy="146" rx="28" ry="6" fill="rgba(30,24,16,.22)" />
      <ellipse cx="52" cy="128" rx="14" ry="7" fill={BODY} stroke={EYE} strokeWidth="1.3" transform="rotate(-20 52 128)" />
      <ellipse cx="108" cy="122" rx="14" ry="7" fill={BODY} stroke={EYE} strokeWidth="1.3" transform="rotate(24 108 122)" />
      <ellipse cx="78" cy="100" rx="30" ry="28" fill={BODY} stroke={EYE} strokeWidth="1.6" />
      <ellipse cx="82" cy="106" rx="16" ry="14" fill={BELLY} />
      <path d="M50 92c-16 2-20 14-10 18" fill="none" stroke={BODY} strokeWidth="8" strokeLinecap="round" />
      <path d="M108 84c14-4 22 8 14 16" fill="none" stroke={BODY} strokeWidth="8" strokeLinecap="round" />
      <ellipse cx="96" cy="58" rx="28" ry="24" fill={BODY} stroke={EYE} strokeWidth="1.6" />
      <Eyes cx={82} cy={48} />
      <Eyes cx={114} cy={44} />
      <path d="M58 70c18-8 40-2 48 10 2 4-8 8-16 4-8-4-22-6-32-14z" fill={SCARF} />
    </g>
  );
}

function PoseArt({ pose }: { readonly pose: FrogPose }) {
  if (pose === 'sit') return <Sit />;
  if (pose === 'side') return <Side />;
  if (pose === 'back') return <Back />;
  if (pose === 'sleep') return <Sleep />;
  if (pose === 'run') return <Run />;
  if (pose === 'postcard') return <Front holding="card" />;
  if (pose === 'packing') return <Front holding="case" />;
  if (pose === 'lookup') return <Front lookup />;
  return <Front />;
}

/** Cartoon frog. Palette tokens are the character sheet: body, belly, scarf, eye. */
export function FrogGlyph({
  pose = 'front',
  charm = false,
}: {
  readonly pose?: FrogPose;
  readonly charm?: boolean;
}) {
  return (
    <svg className="frog-glyph" viewBox="0 0 160 160" aria-hidden="true">
      <PoseArt pose={pose} />
      {charm ? (
        <g transform="translate(118 118)">
          <path d="M6 0c2 4 2 7 0 9-2-2-2-5 0-9z" fill="#8C5A32" />
          <circle cx="6" cy="14" r="6" fill="#A56B3C" stroke={EYE} strokeWidth=".7" />
        </g>
      ) : null}
    </svg>
  );
}
