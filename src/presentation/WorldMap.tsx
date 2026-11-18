import { useMemo } from 'react';
import type { CityStat } from '../domain/services/statistics';
import { project } from '../infrastructure/geo/projection';
import { WORLD_COUNTRIES } from '../infrastructure/geo/world';

interface Placed {
  stat: CityStat;
  x: number;
  y: number;
}

export interface WorldMapProps {
  cities: readonly CityStat[];
  visitedCountries: ReadonlySet<string>;
  selectedCityKeys?: ReadonlySet<string>;
  onSelectCity?: (cityKey: string) => void;
  ariaLabel: string;
  className?: string;
  labelLimit?: number;
}

const CLUSTER_DISTANCE = 17;

export function WorldMap({
  cities,
  visitedCountries,
  selectedCityKeys,
  onSelectCity,
  ariaLabel,
  className = 'map-svg',
  labelLimit = 40,
}: WorldMapProps) {
  const placed = useMemo(() => {
    const out: Placed[] = [];
    for (const stat of cities) {
      if (!stat.centroid) continue;
      const point = project(stat.centroid.lat, stat.centroid.lng);
      out.push({ stat, x: point.x, y: point.y });
    }
    return out;
  }, [cities]);

  const clusters = useMemo(() => {
    const groups: { x: number; y: number; members: Placed[] }[] = [];
    for (const item of placed) {
      const group = groups.find((candidate) => Math.hypot(candidate.x - item.x, candidate.y - item.y) < CLUSTER_DISTANCE);
      if (group) {
        group.members.push(item);
        group.x = group.members.reduce((sum, member) => sum + member.x, 0) / group.members.length;
        group.y = group.members.reduce((sum, member) => sum + member.y, 0) / group.members.length;
      } else {
        groups.push({ x: item.x, y: item.y, members: [item] });
      }
    }
    return groups;
  }, [placed]);

  return (
    <svg className={className} viewBox="0 0 1000 640" role="img" aria-label={ariaLabel}>
      <g aria-hidden="true">
        {WORLD_COUNTRIES.map((country) => (
          <path
            key={country.id}
            d={country.d}
            className={`country${visitedCountries.has(country.id) ? ' is-visited' : ''}`}
          />
        ))}
      </g>
      <g className="graticule" aria-hidden="true">
        <line x1="0" y1="160" x2="1000" y2="160" />
        <line x1="0" y1="320" x2="1000" y2="320" />
        <line x1="0" y1="480" x2="1000" y2="480" />
        <line x1="250" y1="0" x2="250" y2="640" />
        <line x1="500" y1="0" x2="500" y2="640" />
        <line x1="750" y1="0" x2="750" y2="640" />
      </g>
      {clusters.map((cluster) => {
        const members = cluster.members;
        const first = members[0];
        if (!first) return null;
        const selected = selectedCityKeys ? members.some((member) => selectedCityKeys.has(member.stat.cityKey)) : false;
        if (members.length === 1) {
          const { stat } = first;
          return (
            <g
              key={stat.cityKey}
              className={`map-city${selected ? ' is-selected' : ''}`}
              role={onSelectCity ? 'button' : undefined}
              tabIndex={onSelectCity ? 0 : undefined}
              aria-label={`${stat.name}，${stat.countryName}，${stat.photoCount} 张照片`}
              onClick={onSelectCity ? () => onSelectCity(stat.cityKey) : undefined}
              onKeyDown={
                onSelectCity
                  ? (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSelectCity(stat.cityKey);
                      }
                    }
                  : undefined
              }
            >
              <circle className="halo" cx={first.x} cy={first.y} r={9} />
              <circle className="marker" cx={first.x} cy={first.y} r={3.6} />
              <text className="city-label" x={first.x + 7} y={first.y + 3.5}>
                {stat.name}
              </text>
            </g>
          );
        }
        const label = members
          .slice(0, 3)
          .map((member) => member.stat.name)
          .join('、');
        const photos = members.reduce((sum, member) => sum + member.stat.photoCount, 0);
        return (
          <g
            key={members.map((member) => member.stat.cityKey).join('|')}
            className="map-cluster"
            aria-label={`${label}${members.length > 3 ? ` 等 ${members.length} 城` : ''}，${photos} 张照片`}
          >
            <circle className="cluster" cx={cluster.x} cy={cluster.y} r={10} />
            <text className="cluster-count" x={cluster.x} y={cluster.y}>
              {members.length}
            </text>
          </g>
        );
      })}
      {placed.length > 0 && placed.length <= labelLimit ? null : null}
    </svg>
  );
}
