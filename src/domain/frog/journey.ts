import type { CityRef } from "../city/city-ref";

import {interpolateRoute,type FrogRoutePoint,type TravelWaypoint} from './roaming';
export type FrogPace = "natural" | "preview";
export type JourneyPhase =
  | "resting"
  | "packing"
  | "outbound"
  | "visiting"
  | "returning";
export interface FrogJourney {
  readonly id: string;
  readonly number: number;
  readonly source: "autonomous" | "directed";
  readonly pace: FrogPace;
  readonly from: CityRef;
  readonly destination: CityRef;
  readonly prepareAt: number;
  readonly departAt: number;
  readonly arriveAt: number;
  readonly returnAt: number;
  readonly homeAt: number;
  readonly letterAt: number | null;
  readonly wishId: string | null;
  readonly letterRecorded: boolean;
  readonly note: string;
  readonly route?: readonly FrogRoutePoint[];
}
export interface FrogDirection {
  readonly destination: CityRef;
  readonly wishId: string;
  readonly requestedAt: number;
}
export interface FrogTravelState {
  readonly enabled: boolean;
  readonly pace: FrogPace;
  readonly sequence: number;
  readonly current: FrogJourney | null;
  readonly direction: FrogDirection | null;
  readonly history: readonly FrogJourney[];
  readonly waypoints?: readonly TravelWaypoint[];
  readonly motionPausedAt?: number | undefined;
}
export const EMPTY_FROG_TRAVEL: FrogTravelState = {
  enabled: true,
  pace: "natural",
  sequence: 0,
  current: null,
  direction: null,
  history: [],
};
const MINUTE = 60_000;

export function journeyPhase(
  journey: FrogJourney | null,
  now: number,
): JourneyPhase {
  if (!journey || now < journey.prepareAt || now >= journey.homeAt)
    return "resting";
  if (now < journey.departAt) return "packing";
  if (now < journey.arriveAt) return "outbound";
  if (now < journey.returnAt) return "visiting";
  return "returning";
}
export function journeyAway(journey: FrogJourney | null, now: number): boolean {
  return journey !== null && now >= journey.departAt && now < journey.homeAt;
}
function hash(text: string): number {
  let seed = 2166136261;
  for (const char of text)
    seed = Math.imul(seed ^ char.charCodeAt(0), 16777619);
  return seed >>> 0;
}
export function chooseFrogDestination(
  state: FrogTravelState,
  home: CityRef,
  cities: readonly CityRef[],
): CityRef | null {
  const recent = new Set(
    state.history.slice(-2).map((journey) => journey.destination.key),
  );
  const eligible = cities.filter(
    (city) => city.key !== home.key && city.centroid !== null,
  );
  const fresh = eligible.filter((city) => !recent.has(city.key));
  const choices = fresh.length ? fresh : eligible;
  return (
    choices[hash(`${home.key}:${state.sequence + 1}`) % choices.length] ?? null
  );
}
function distance(from: CityRef, to: CityRef): number {
  if (!from.centroid || !to.centroid) return 5000;
  const radians = Math.PI / 180;
  const a = from.centroid,
    b = to.centroid;
  const h =
    Math.sin(((b.lat - a.lat) * radians) / 2) ** 2 +
    Math.cos(a.lat * radians) *
      Math.cos(b.lat * radians) *
      Math.sin(((b.lng - a.lng) * radians) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function planFrogJourney(
  state: FrogTravelState,
  home: CityRef,
  cities: readonly CityRef[],
  now: number,
  soon = false,
): FrogTravelState {
  if (state.current || (!state.enabled && !state.direction)) return state;
  const destination =
    state.direction?.destination ?? chooseFrogDestination(state, home, cities);
  if (!destination) return state;
  const sequence = state.sequence + 1;
  const number = (state.history.at(-1)?.number ?? 0) + 1;
  const seed = hash(`${home.key}:${destination.key}:${number}`);
  const fast = state.pace === "preview";
  const rest = fast
    ? soon
      ? 1000
      : 8000
    : (soon ? 2 : 30 + (seed % 31)) * MINUTE;
  const packing = fast ? 5000 : 2 * MINUTE;
  const leg = fast
    ? 8000 + (seed % 5000)
    : Math.round(
        (45 + Math.min(180, distance(home, destination) / 60) + (seed % 25)) *
          MINUTE,
      );
  const stay = fast ? 12000 : (45 + (seed % 91)) * MINUTE;
  const prepareAt = now + rest,
    departAt = prepareAt + packing,
    arriveAt = departAt + leg,
    returnAt = arriveAt + stay,
    homeAt = returnAt + leg;
  // A directed journey promises a letter; autonomous journeys sometimes return without one.
  const sendLetter = state.direction !== null || number % 3 !== 0;
  const scenes = [
    "我在小巷的长椅上歇了一会儿，给你留了一个座位。",
    "把地图折到这一页，想起家里壁炉旁的光。",
    "沿着街角慢慢走，决定把这一页夹进旅记本。",
  ];
  const note = `【模拟旅记 · 第${number}趟】${destination.name}。${scenes[seed % scenes.length]}${state.direction ? "这次照着你留的方向走。" : "这是我自己挑的一站。"}`;
  const journey: FrogJourney = {
    id: `frog-journey-${sequence}`,
    number,
    source: state.direction ? "directed" : "autonomous",
    pace: state.pace,
    from: home,
    destination,
    prepareAt,
    departAt,
    arriveAt,
    returnAt,
    homeAt,
    letterAt: sendLetter ? arriveAt + stay / 2 : null,
    wishId: sendLetter
      ? (state.direction?.wishId ?? `frog-letter-${sequence}`)
      : null,
    letterRecorded: false,
    note,
  };
  return { ...state, sequence, current: journey, direction: null };
}

/** Reconcile at most the already planned journey. Never invent a chain of offline trips. */
export function advanceFrogJourney(
  state: FrogTravelState,
  home: CityRef,
  cities: readonly CityRef[],
  now: number,
): { state: FrogTravelState; letter: FrogJourney | null; returned: boolean } {
  if(state.motionPausedAt!==undefined)now=state.motionPausedAt;
  let current = state.current;
  let letter: FrogJourney | null = null;
  if (
    current?.letterAt !== null &&
    current?.letterAt !== undefined &&
    now >= current.letterAt &&
    !current.letterRecorded
  ) {
    letter = current;
    current = { ...current, letterRecorded: true };
  }
  let next = current === state.current ? state : { ...state, current };
  const returned = current !== null && now >= current.homeAt;
  if (returned && current)
    next = {
      ...next,
      current: null,
      history: [...state.history, current].slice(-12),
    };
  if (!next.current) next = planFrogJourney(next, home, cities, now);
  return { state: next, letter, returned };
}

export function nextJourneyWake(
  state: FrogTravelState,
  now: number,
): number | null {
  const j = state.current;
  if (!j || state.motionPausedAt!==undefined) return null;
  const times = [j.prepareAt, j.departAt, j.arriveAt, j.returnAt, j.homeAt];
  if (!j.letterRecorded && j.letterAt !== null) times.push(j.letterAt);
  return Math.min(...times.filter((at) => at > now), now + 60_000);
}
export function frogJourneyLocation(
  journey: FrogJourney | null,
  home: CityRef,
  now: number,
): { lat: number; lng: number } | null {
  if (!journey || now < journey.departAt || now >= journey.homeAt)
    return home.centroid;
  if(journey.route?.length) return interpolateRoute(journey.route,now,home);
  const from = journey.from.centroid,
    destination = journey.destination.centroid;
  if (!from || !destination) return null;
  const ratio =
    now < journey.arriveAt
      ? (now - journey.departAt) / (journey.arriveAt - journey.departAt)
      : now < journey.returnAt
        ? 1
        : 1 - (now - journey.returnAt) / (journey.homeAt - journey.returnAt);
  const deltaLng = ((destination.lng - from.lng + 540) % 360) - 180;
  if (now >= journey.returnAt && home.centroid) {
    const progress = 1 - ratio;
    const target = home.centroid;
    const delta = ((target.lng - destination.lng + 540) % 360) - 180;
    return {
      lat: destination.lat + (target.lat - destination.lat) * progress,
      lng: ((destination.lng + delta * progress + 540) % 360) - 180,
    };
  }
  return {
    lat: from.lat + (destination.lat - from.lat) * ratio,
    lng: ((from.lng + deltaLng * ratio + 540) % 360) - 180,
  };
}
export function validFrogTravel(state: FrogTravelState): boolean {
  const validCity = (city: CityRef) =>
    !!city &&
    typeof city.key === "string" &&
    !!city.centroid &&
    Number.isFinite(city.centroid.lat) &&
    Math.abs(city.centroid.lat) <= 90 &&
    Number.isFinite(city.centroid.lng) &&
    Math.abs(city.centroid.lng) <= 180;
  const validJourney = (j: FrogJourney) =>
    !!j &&
    typeof j.id === "string" &&
    Number.isSafeInteger(j.number) &&
    j.number > 0 &&
    (j.source === "autonomous" || j.source === "directed") &&
    (j.pace === "natural" || j.pace === "preview") &&
    validCity(j.from) &&
    validCity(j.destination) &&
    [j.prepareAt, j.departAt, j.arriveAt, j.returnAt, j.homeAt].every(
      Number.isFinite,
    ) &&
    j.prepareAt < j.departAt &&
    j.departAt < j.arriveAt &&
    j.arriveAt < j.returnAt &&
    j.returnAt < j.homeAt &&
    (j.letterAt === null ||
      (Number.isFinite(j.letterAt) &&
        j.letterAt >= j.arriveAt &&
        j.letterAt < j.returnAt)) &&
    typeof j.letterRecorded === "boolean" &&
    typeof j.note === "string" &&
    j.note.length <= 200 &&
    (j.route===undefined || (Array.isArray(j.route)&&j.route.length>=2&&j.route.length<=100&&j.route.every((p,i)=>Number.isFinite(p.at)&&Number.isFinite(p.lat)&&Math.abs(p.lat)<=90&&Number.isFinite(p.lng)&&Math.abs(p.lng)<=180&&(p.kind==='walk'||p.kind==='transit')&&(i===0||p.at>j.route![i-1]!.at))&&j.route[0]!.at===j.departAt&&j.route.at(-1)!.at===j.homeAt));
  return (
    !!state &&
    typeof state.enabled === "boolean" &&
    (state.motionPausedAt===undefined||Number.isFinite(state.motionPausedAt)) &&
    (state.waypoints===undefined||(Array.isArray(state.waypoints)&&state.waypoints.length<=500&&state.waypoints.every(p=>typeof p.id==='string'&&typeof p.name==='string'&&p.name.trim().length>0&&p.name.length<=100&&typeof p.country==='string'&&p.country.length<=100&&Number.isFinite(p.createdAt)&&Number.isFinite(p.lat)&&Math.abs(p.lat)<=90&&Number.isFinite(p.lng)&&Math.abs(p.lng)<=180&&(p.source==='map'||p.source==='poi')))) &&
    (state.pace === "natural" || state.pace === "preview") &&
    Number.isSafeInteger(state.sequence) &&
    state.sequence >= 0 &&
    Array.isArray(state.history) &&
    state.history.length <= 12 &&
    state.history.every(validJourney) &&
    (state.current === null || validJourney(state.current)) &&
    (state.direction === null ||
      (validCity(state.direction.destination) &&
        typeof state.direction.wishId === "string" &&
        Number.isFinite(state.direction.requestedAt)))
  );
}
