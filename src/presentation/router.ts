import { useSyncExternalStore } from 'react';

export interface Route {
  readonly hash: string;
  readonly screen: 'home' | 'import' | 'trip' | 'replay' | 'map' | 'fill' | 'frog' | 'gaps' | 'settings';
  readonly tripId: string | null;
}

const SCREENS = new Set(['home', 'import', 'trip', 'replay', 'map', 'fill', 'frog', 'gaps', 'settings']);

function currentHash(): string {
  return window.location.hash.replace(/^#\/?/, '') || 'home';
}

function listener(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

export function parse(hash: string): Route {
  const [head = 'home', second] = hash.split('/');
  if (head === 'trip' || head === 'replay') {
    return { hash, screen: head, tripId: second ? decodeURIComponent(second) : null };
  }
  if (SCREENS.has(head)) {
    return { hash, screen: head as Route['screen'], tripId: null };
  }
  return { hash, screen: 'home', tripId: null };
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(listener, currentHash, () => 'home');
  return parse(hash);
}

export function navigate(to: string): void {
  window.location.hash = `/${to.replace(/^#?\/?/, '')}`;
}

export function tripHref(tripId: string): string {
  return `#/trip/${encodeURIComponent(tripId)}`;
}
