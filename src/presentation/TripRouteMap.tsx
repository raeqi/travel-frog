import { useMemo } from 'react';
import type { Visit } from '../domain/visit/visit';

interface Props {
  visits: readonly Visit[];
  activeSequence?: number | null;
  ariaLabel: string;
  showLabels?: boolean;
}

const WIDTH = 760;
const HEIGHT = 430;
const PADDING = 56;

interface Point {
  visit: Visit;
  x: number;
  y: number;
  lat: number;
  lng: number;
}

/**
 * Several visits often share one city centroid. Spread those markers on a small ring so every
 * stop and its label stays readable instead of stacking into a single dot.
 */
function fanOutCoincident(points: Point[]): void {
  const groups: Point[][] = [];
  for (const point of points) {
    const group = groups.find((members) => Math.hypot((members[0]?.x ?? 0) - point.x, (members[0]?.y ?? 0) - point.y) < 14);
    if (group) group.push(point);
    else groups.push([point]);
  }
  for (const group of groups) {
    if (group.length < 2) continue;
    const radius = Math.min(18 + group.length * 2, 48);
    group.forEach((point, index) => {
      const angle = (Math.PI * 2 * index) / group.length - Math.PI / 2;
      point.x += Math.cos(angle) * radius;
      point.y += Math.sin(angle) * radius;
    });
  }
}

/**
 * Projects the real visit coordinates into the local SVG frame. No third-party tiles are used,
 * and the route is only drawn when at least one visit carries a coordinate.
 */
export function TripRouteMap({ visits, activeSequence = null, ariaLabel, showLabels = true }: Props) {  const points = useMemo<Point[]>(() => {
    const located = visits.filter((visit) => visit.geo !== null);
    if (located.length === 0) return [];
    const lats = located.map((visit) => visit.geo?.lat ?? 0);
    const lngs = located.map((visit) => visit.geo?.lng ?? 0);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const spanLat = Math.max(maxLat - minLat, 0.02);
    const spanLng = Math.max(maxLng - minLng, 0.02);
    const scale = Math.min((WIDTH - PADDING * 2) / spanLng, (HEIGHT - PADDING * 2) / spanLat);
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    const placed = located.map((visit) => {
      const geo = visit.geo;
      if (!geo) throw new Error('unreachable');
      return {
        visit,
        x: WIDTH / 2 + (geo.lng - centerLng) * scale,
        y: HEIGHT / 2 - (geo.lat - centerLat) * scale,
        lat: geo.lat,
        lng: geo.lng,
      };
    });
    fanOutCoincident(placed);
    return placed;
  }, [visits]);

  if (points.length === 0) {
    return (
      <svg className="local-map" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={ariaLabel}>
        <rect width={WIDTH} height={HEIGHT} fill="var(--color-map-water)" />
        <text className="geo" x={WIDTH / 2} y={HEIGHT / 2} textAnchor="middle">
          NO GEOLOCATION
        </text>
      </svg>
    );
  }

  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');

  return (
    <svg className="local-map" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={ariaLabel}>
      <rect width={WIDTH} height={HEIGHT} fill="var(--color-map-water)" />
      <g aria-hidden="true" opacity={0.35}>
        {[1, 2, 3].map((step) => (
          <line key={`h${step}`} x1="0" y1={(HEIGHT / 4) * step} x2={WIDTH} y2={(HEIGHT / 4) * step} stroke="var(--color-map-border)" strokeWidth="0.6" />
        ))}
        {[1, 2, 3].map((step) => (
          <line key={`v${step}`} x1={(WIDTH / 4) * step} y1="0" x2={(WIDTH / 4) * step} y2={HEIGHT} stroke="var(--color-map-border)" strokeWidth="0.6" />
        ))}
      </g>
      {points.length > 1 ? <path className="route" d={path} /> : null}
      {points.map((point, index) => {
        const active = activeSequence === point.visit.sequence;
        const flip = index % 2 === 1;
        return (
          <g key={point.visit.id} className={`stop${active ? ' is-active' : ''}`}>
            <circle cx={point.x} cy={point.y} r={10} />
            <text className="n" x={point.x} y={point.y}>
              {point.visit.sequence + 1}
            </text>
            {showLabels ? (
              <text
                className="lbl"
                x={point.x + (flip ? -15 : 15)}
                y={point.y + (flip ? 14 : -10)}
                textAnchor={flip ? 'end' : 'start'}
              >
                {point.visit.displayName}
              </text>
            ) : null}
          </g>
        );
      })}
      <text className="geo" x={16} y={HEIGHT - 14}>
        {points[0]?.lat.toFixed(3)}, {points[0]?.lng.toFixed(3)}
      </text>
      <text className="geo" x={WIDTH - 16} y={HEIGHT - 14} textAnchor="end">
        OFFLINE ROUTE · {points.length} STOPS
      </text>
    </svg>
  );
}
