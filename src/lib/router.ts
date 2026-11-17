import { useEffect, useState } from 'react';

export type RouteName =
  | 'home'
  | 'import'
  | 'trip'
  | 'replay'
  | 'map'
  | 'fill'
  | 'frog'
  | 'gaps'
  | 'settings';

export interface Route {
  name: RouteName;
  param?: string;
}

const VALID: RouteName[] = ['home', 'import', 'trip', 'replay', 'map', 'fill', 'frog', 'gaps', 'settings'];

export function parseRoute(hash: string): Route {
  const clean = hash.replace(/^#\/?/, '');
  const [name, param] = clean.split('/');
  if (VALID.includes(name as RouteName)) {
    return { name: name as RouteName, param: param ? decodeURIComponent(param) : undefined };
  }
  return { name: 'home' };
}

export function navigate(path: string): void {
  const next = path.startsWith('#') ? path : `#/${path.replace(/^\//, '')}`;
  if (window.location.hash !== next) window.location.hash = next;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  useEffect(() => {
    if (!window.location.hash) {
      window.history.replaceState(null, '', '#/home');
      setRoute({ name: 'home' });
    }
    const onChange = () => {
      setRoute(parseRoute(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function routePath(name: RouteName, param?: string): string {
  return param ? `#/${name}/${encodeURIComponent(param)}` : `#/${name}`;
}
