import { useEffect, useRef, useState } from 'react';

export type SearchKind = 'trip' | 'city' | 'wish';

export interface SearchItem {
  readonly id: string;
  readonly kind: SearchKind;
  readonly title: string;
  readonly subtitle: string;
  readonly go: string;
}

const GROUP_LABELS: Record<SearchKind, string> = {
  trip: '旅行',
  city: '城市',
  wish: '明信片',
};

const GROUP_ICONS: Record<SearchKind, string> = {
  trip: 'pres-icon',
  city: 'pres-icon map',
  wish: 'pres-icon pres-wish',
};

export interface SearchPanelProps {
  readonly open: boolean;
  readonly items: readonly SearchItem[];
  readonly onClose: () => void;
  readonly onPick: (item: SearchItem) => void;
}

export function SearchPanel({ open, items, onClose, onPick }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!open) return null;
  const needle = query.trim().toLocaleLowerCase();
  const matches = needle
    ? items.filter((item) => item.title.toLocaleLowerCase().includes(needle) || item.subtitle.toLocaleLowerCase().includes(needle))
    : items;
  const groups: SearchKind[] = ['trip', 'city', 'wish'];

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <section className="palette" aria-label="搜索">
        <div className="palette-input">
          <svg viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="9" cy="9" r="5.2" />
            <path d="m13 13 4 4" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            placeholder="搜索城市、年份或一句话记忆"
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => { setQuery(event.target.value); setActive(0); }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setActive(index => (index + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % Math.max(1,matches.length)); }
              if (event.key === 'Enter' && matches[Math.min(active,matches.length-1)]) onPick(matches[Math.min(active,matches.length-1)]!);
            }}
          />
          <kbd>Esc</kbd>
        </div>
        <div className="palette-body">
          {matches.length === 0 ? <p className="palette-group">没有找到匹配的旅行或城市</p> : null}
          {groups.map((kind) => {
            const groupItems = matches.filter((item) => item.kind === kind);
            if (groupItems.length === 0) return null;
            return (
              <div key={kind}>
                <p className="palette-group">{GROUP_LABELS[kind]}</p>
                {groupItems.map((item) => (
                  <button key={item.id} className={`presult${matches.indexOf(item) === active ? ' is-active' : ''}`} type="button" onClick={() => onPick(item)}>
                    <span className={GROUP_ICONS[item.kind]} aria-hidden="true" />
                    <span>
                      <strong>{item.title}</strong>
                      <em>{item.subtitle}</em>
                    </span>
                    <span className="go">{item.go}</span>
                  </button>
                ))}
              </div>
            );
          })}
          <p className="palette-foot">
            <span>↑↓ 选择 · ↵ 跳转</span>
            <span>Esc 关闭</span>
          </p>
        </div>
      </section>
    </>
  );
}
