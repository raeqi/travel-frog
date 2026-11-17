import { useMemo } from 'react';
import type { Trip } from '../types';
import { nearestCity, project } from '../lib/geo';
import { WORLD_COUNTRIES } from '../lib/worldGeo';

export interface MapCity {
  name: string;
  country: string;
  code: string;
  lat: number;
  lng: number;
  year: number;
  photos: number;
  trips: number;
}

export const COUNTRY_FILL = ['#dfe6e0', '#e9e2d8', '#e0e3ea', '#ebe4dc', '#e4e9de', '#e7dfe6'];

export function citiesFromTrips(trips: Trip[], photos: Record<string, { tripId?: string }>): MapCity[] {
  const map = new Map<string, MapCity>();
  for (const trip of trips) {
    const year = new Date(trip.endAt).getFullYear();
    const tripPhotos = Object.values(photos).filter((p) => p.tripId === trip.id).length;
    const seen = new Set<string>();
    for (const visit of trip.visits) {
      if (visit.lat == null || visit.lng == null) continue;
      const hit = nearestCity(visit.lat, visit.lng);
      const name = hit?.city ?? visit.city;
      const key = `${name}|${hit?.countryCode ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const existing = map.get(key);
      if (existing) {
        existing.photos += tripPhotos;
        existing.trips += 1;
        existing.year = Math.max(existing.year, year);
      } else {
        map.set(key, {
          name,
          country: hit?.country ?? visit.country,
          code: hit?.countryCode ?? '',
          lat: hit?.lat ?? visit.lat,
          lng: hit?.lng ?? visit.lng,
          year,
          photos: tripPhotos,
          trips: 1,
        });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.year - a.year || a.name.localeCompare(b.name, 'zh'));
}

interface Props {
  cities: MapCity[];
  trips: Trip[];
  selected?: string | null;
  dimYear?: string;
  onSelect?: (name: string) => void;
  showRoutes?: boolean;
  showLabels?: boolean;
  ariaLabel?: string;
}

export function WorldMap({
  cities,
  trips,
  selected,
  dimYear,
  onSelect,
  showRoutes = true,
  showLabels = true,
  ariaLabel = '世界足迹地图',
}: Props) {
  const visitedCodes = useMemo(() => new Set(cities.map((c) => c.code).filter(Boolean)), [cities]);
  const codeColor = useMemo(() => {
    const palette = new Map<string, string>();
    Array.from(visitedCodes).forEach((code, i) => palette.set(code, COUNTRY_FILL[i % COUNTRY_FILL.length]));
    return palette;
  }, [visitedCodes]);

  const routes = useMemo(() => {
    return trips
      .filter((t) => t.visits.filter((v) => v.lat != null).length > 1)
      .map((trip) => ({
        id: trip.id,
        d: trip.visits
          .filter((v) => v.lat != null && v.lng != null)
          .map((v, i) => {
            const p = project(v.lat!, v.lng!);
            return `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
          })
          .join(' '),
      }));
  }, [trips]);

  return (
    <svg viewBox="0 0 1000 640" role="img" aria-label={ariaLabel} className="world-svg">
      <rect width="1000" height="640" fill="#f6f6f6" />
      <g className="graticule">
        {[20, 40, 60, 80].map((y) => <line key={`h${y}`} x1="0" y1={(y / 100) * 640} x2="1000" y2={(y / 100) * 640} />)}
        {[100, 200, 300, 400, 500, 600, 700, 800, 900].map((x) => <line key={`v${x}`} x1={x} y1="0" x2={x} y2="640" />)}
      </g>
      <g className="countries">
        {WORLD_COUNTRIES.map((c, i) => {
          const fill = codeColor.get(c.id);
          return (
            <path
              key={`${c.id}-${i}`}
              d={c.d}
              className={`world-country ${fill ? 'is-visited' : ''}`}
              fill={fill ?? '#ececec'}
              stroke="#cfcfcf"
              strokeWidth="0.8"
            >
              <title>{c.name}</title>
            </path>
          );
        })}
      </g>
      {showRoutes && (
        <g className="world-routes">
          {routes.map((r) => <path key={r.id} d={r.d} />)}
        </g>
      )}
      <g className="world-cities">
        {cities.map((c) => {
          const p = project(c.lat, c.lng);
          const dim = Boolean(dimYear && dimYear !== 'all' && String(c.year) !== dimYear);
          const isSelected = selected === c.name;
          return (
            <g
              key={`${c.name}-${c.code}`}
              className={`world-city ${dim ? 'is-dim' : ''} ${isSelected ? 'is-selected' : ''}`}
              onClick={() => onSelect?.(c.name)}
              role={onSelect ? 'button' : undefined}
              tabIndex={onSelect ? 0 : undefined}
            >
              {isSelected ? <circle cx={p.x} cy={p.y} r="9" className="city-halo" /> : null}
              <circle cx={p.x} cy={p.y} r={isSelected ? 5 : 3.6} />
              {showLabels && (
                <text x={p.x + (p.x > 900 ? -9 : 9)} y={p.y + 3} textAnchor={p.x > 900 ? 'end' : 'start'}>
                  {c.name}
                </text>
              )}
              <title>{`${c.name} · ${c.country} · ${c.year} · ${c.photos} 张`}</title>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
