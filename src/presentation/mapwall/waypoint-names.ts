import type { CityResolver } from "../../domain/ports";
import { GazetteerCityResolver } from "../../infrastructure/geo/city-resolver";
import { landAt } from "../../infrastructure/geo/frog-landscape";

const cityNames = new GazetteerCityResolver();
type Point = { lat: number; lng: number };

/** A nearby city is naming context only. It never supplies the saved coordinates. */
export function nearbyWaypointCity(
  point: Point,
  resolver: CityResolver = cityNames,
) {
  return resolver.resolve({
    ...point,
    source: "manual",
    approximate: false,
    accuracyM: null,
  });
}

export function namedMapPoint(
  point: Point,
  resolver: CityResolver = cityNames,
) {
  const nearby = nearbyWaypointCity(point, resolver);
  return {
    ...point,
    name: nearby ? `${nearby.name}附近` : "想去的地方",
    country: landAt(point)?.name ?? nearby?.countryName ?? "未命名地区",
    source: "map" as const,
  };
}
