import { memo } from 'react';

const PATHS: Record<string, { viewBox: string; body: string }> = {
  'home': { viewBox: '0 0 24 24', body: `<path d="M3.5 10.5 12 3l8.5 7.5"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9.5 21v-6h5v6"/>` },
  'trips': { viewBox: '0 0 24 24', body: `<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9h16M9 4v16"/>` },
  'map': { viewBox: '0 0 24 24', body: `<path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2V6Z"/><path d="M9 4v14M15 6v14"/>` },
  'import': { viewBox: '0 0 24 24', body: `<path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5"/><path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15"/>` },
  'pin': { viewBox: '0 0 24 24', body: `<path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/>` },
  'gap': { viewBox: '0 0 24 24', body: `<path d="M5 4h9l5 5v11H5V4Z"/><path d="M14 4v5h5M8.5 13h7M8.5 16.5h4"/>` },
  'settings': { viewBox: '0 0 24 24', body: `<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>` },
  'search': { viewBox: '0 0 24 24', body: `<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 4.5 4.5"/>` },
  'sun': { viewBox: '0 0 24 24', body: `<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>` },
  'moon': { viewBox: '0 0 24 24', body: `<path d="M20 14.5A8 8 0 0 1 9.5 4 8.2 8.2 0 1 0 20 14.5Z"/>` },
  'monitor': { viewBox: '0 0 24 24', body: `<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>` },
  'plus': { viewBox: '0 0 24 24', body: `<path d="M12 5v14M5 12h14"/>` },
  'arrow-right': { viewBox: '0 0 24 24', body: `<path d="M4 12h15M14 6l6 6-6 6"/>` },
  'arrow-left': { viewBox: '0 0 24 24', body: `<path d="M20 12H5M10 6l-6 6 6 6"/>` },
  'chevron-down': { viewBox: '0 0 24 24', body: `<path d="m6 9 6 6 6-6"/>` },
  'chevron-right': { viewBox: '0 0 24 24', body: `<path d="m9 6 6 6-6 6"/>` },
  'check': { viewBox: '0 0 24 24', body: `<path d="m4.5 12.5 5 5L19.5 7"/>` },
  'close': { viewBox: '0 0 24 24', body: `<path d="M6 6l12 12M18 6 6 18"/>` },
  'more': { viewBox: '0 0 24 24', body: `<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>` },
  'clock': { viewBox: '0 0 24 24', body: `<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5.5l3.5 2"/>` },
  'calendar': { viewBox: '0 0 24 24', body: `<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8 3.5v3M16 3.5v3"/>` },
  'photo': { viewBox: '0 0 24 24', body: `<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m5 17 4.5-4 3.5 3 2.5-2.5L20 18"/>` },
  'camera': { viewBox: '0 0 24 24', body: `<path d="M4 8h3l1.5-2h7L17 8h3v11H4V8Z"/><circle cx="12" cy="13" r="3.2"/>` },
  'folder': { viewBox: '0 0 24 24', body: `<path d="M3.5 6.5h6l2 2h9v10h-17v-12Z"/>` },
  'download': { viewBox: '0 0 24 24', body: `<path d="M12 4v11m0 0 4-4m-4 4-4-4"/><path d="M4 19h16"/>` },
  'trash': { viewBox: '0 0 24 24', body: `<path d="M4.5 7h15M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/><path d="M10 11v5M14 11v5"/>` },
  'lock': { viewBox: '0 0 24 24', body: `<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 1 1 7 0v2.5"/>` },
  'cloud': { viewBox: '0 0 24 24', body: `<path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6 9.5 4.25 4.25 0 0 0 7 18Z"/>` },
  'database': { viewBox: '0 0 24 24', body: `<ellipse cx="12" cy="5.5" rx="7" ry="2.5"/><path d="M5 5.5v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-6"/><path d="M5 11.5v7c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-7"/>` },
  'alert': { viewBox: '0 0 24 24', body: `<path d="M12 3.5 21 20H3L12 3.5Z"/><path d="M12 9v5M12 17v.5"/>` },
  'info': { viewBox: '0 0 24 24', body: `<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.5"/>` },
  'merge': { viewBox: '0 0 24 24', body: `<path d="M5 5v3c0 3 2.5 4 5 4h9M5 19v-3c0-3 2.5-4 5-4"/><path d="m16 9 3 3-3 3"/>` },
  'split': { viewBox: '0 0 24 24', body: `<path d="M5 12h9M14 12c3 0 5-2 5-5V5M14 12c3 0 5 2 5 5v2"/><path d="m11 9 3 3-3 3"/>` },
  'eye': { viewBox: '0 0 24 24', body: `<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/>` },
  'list': { viewBox: '0 0 24 24', body: `<path d="M8 6h12M8 12h12M8 18h12M4 6h.5M4 12h.5M4 18h.5"/>` },
  'grid': { viewBox: '0 0 24 24', body: `<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>` },
  'play': { viewBox: '0 0 24 24', body: `<path d="M8 5v14l11-7L8 5Z"/>` },
  'pause': { viewBox: '0 0 24 24', body: `<path d="M8 5v14M16 5v14"/>` },
  'locate': { viewBox: '0 0 24 24', body: `<circle cx="12" cy="12" r="6"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="1.5"/>` },
  'route': { viewBox: '0 0 24 24', body: `<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.5 6H16a3 3 0 0 1 0 6H8a3 3 0 0 0 0 6h7.5"/>` },
  'shield': { viewBox: '0 0 24 24', body: `<path d="M12 3 20 6v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z"/><path d="m8.5 12 2.3 2.3 4.7-5"/>` },
  'edit': { viewBox: '0 0 24 24', body: `<path d="M4 20h4l11-11-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>` },
  'filter': { viewBox: '0 0 24 24', body: `<path d="M4 6h16M7 12h10M10 18h4"/>` },
  'refresh': { viewBox: '0 0 24 24', body: `<path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 0-2 5"/>` },
  'external': { viewBox: '0 0 24 24', body: `<path d="M14 4h6v6M20 4l-8 8"/><path d="M18 14v5H5V6h5"/>` },
  'keyboard': { viewBox: '0 0 24 24', body: `<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.5M9.5 10h.5M13 10h.5M16.5 10h.5M6 14h12"/>` },
  'zoom-in': { viewBox: '0 0 24 24', body: `<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 4.5 4.5M10.5 7.5v6M7.5 10.5h6"/>` },
  'zoom-out': { viewBox: '0 0 24 24', body: `<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 4.5 4.5M7.5 10.5h6"/>` },
  'frog': { viewBox: '0 0 120 96', body: `<ellipse cx="60" cy="62" rx="36" ry="24"/><circle cx="42" cy="33" r="13"/><circle cx="78" cy="33" r="13"/><circle cx="42" cy="34" r="3.5" fill="currentColor" stroke="none"/><circle cx="78" cy="34" r="3.5" fill="currentColor" stroke="none"/><path d="M45 63q15 13 30 0"/><path d="M26 79q-7 8 3 10h18M94 79q7 8-3 10H73"/>` },
};

export const Sprite = memo(function Sprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      {Object.entries(PATHS).map(([name, item]) => (
        <symbol key={name} id={`i-${name}`} viewBox={item.viewBox} dangerouslySetInnerHTML={{ __html: item.body }} />
      ))}
    </svg>
  );
});

export function Icon({ name, className = 'icon' }: { name: string; className?: string }) {
  return (
    <svg className={className} aria-hidden="true" focusable="false">
      <use href={`#i-${name}`} />
    </svg>
  );
}
