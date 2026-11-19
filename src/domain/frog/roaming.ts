import type { CityRef } from "../city/city-ref";
import type { FrogJourney } from "./journey";
export interface TravelWaypoint {
  readonly id: string;
  readonly name: string;
  readonly country: string;
  readonly lat: number;
  readonly lng: number;
  readonly source: "map" | "poi";
  readonly createdAt: number;
}
export interface FrogRoutePoint {
  readonly lat: number;
  readonly lng: number;
  readonly at: number;
  readonly kind: "walk" | "transit";
}
export interface FrogLandscape {
  destination(home: CityRef, sequence: number): CityRef | null;
  route(journey: FrogJourney): readonly FrogRoutePoint[];
}
export function waypointCity(point: TravelWaypoint): CityRef {
  return {
    key: `point:${point.lat.toFixed(6)}:${point.lng.toFixed(6)}`,
    name: point.name,
    countryName: point.country,
    countryCode: "XXX",
    centroid: {
      lat: point.lat,
      lng: point.lng,
      source: "manual",
      accuracyM: null,
      approximate: true,
    },
    source: "manual",
    confidence: "high",
  };
}
export function shiftJourney(j: FrogJourney, delta: number): FrogJourney {
  return {
    ...j,
    prepareAt: j.prepareAt + delta,
    departAt: j.departAt + delta,
    arriveAt: j.arriveAt + delta,
    returnAt: j.returnAt + delta,
    homeAt: j.homeAt + delta,
    letterAt: j.letterAt === null ? null : j.letterAt + delta,
    ...(j.route
      ? { route: j.route.map((p) => ({ ...p, at: p.at + delta })) }
      : {}),
  };
}
export function interpolateRoute(
  route: readonly FrogRoutePoint[],
  now: number,
  home: CityRef,
): { lat: number; lng: number } | null {
  const a = route.findLast((p) => p.at <= now) ?? route[0];
  const original = route.find((p) => p.at > now);
  if (!a) return null;
  if (!original) return home.centroid ?? a;
  const b =
    original === route.at(-1) && home.centroid
      ? { ...original, ...home.centroid }
      : original;
  const t = Math.max(0, Math.min(1, (now - a.at) / (b.at - a.at)));
  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lng:
      ((a.lng + (((b.lng - a.lng + 540) % 360) - 180) * t + 540) % 360) - 180,
  };
}
export function routeActivity(
  j: FrogJourney | null,
  now: number,
): "walk" | "transit" | "home" {
  if (!j || now < j.departAt || now >= j.homeAt) return "home";
  return (
    j.route?.find((p) => p.at > now)?.kind ??
    (now >= j.arriveAt && now < j.returnAt ? "walk" : "transit")
  );
}
