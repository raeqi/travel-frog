import { describe, expect, it } from "vitest";
import { DEFAULT_HOME_CITY } from "../../domain/home/home";
import {
  EMPTY_FROG_TRAVEL,
  frogJourneyLocation,
  planFrogJourney,
  validFrogTravel,
} from "../../domain/frog/journey";
import { interpolateRoute, shiftJourney } from "../../domain/frog/roaming";
import {
  landAt,
  landRoamingRoute,
  randomLandDestination,
} from "./frog-landscape";

describe("recoverable land roaming", () => {
  it("samples reproducible land coordinates beyond the preset cities", () => {
    expect(landAt({ lat: 0, lng: -140 })).toBeNull();
    expect(landAt({ lat: 48.858, lng: 2.295 })?.name).toBe("法国");
    const destinations = Array.from(
      { length: 30 },
      (_, i) => randomLandDestination(DEFAULT_HOME_CITY, i + 1)!,
    );
    expect(new Set(destinations.map((p) => p.key)).size).toBe(30);
    for (const [i, p] of destinations.entries()) {
      expect(p).toEqual(randomLandDestination(DEFAULT_HOME_CITY, i + 1));
      expect(p.key.startsWith("roam:")).toBe(true);
      expect(landAt(p.centroid!)?.id).toBe(p.countryCode);
      expect(p.countryCode).not.toBe("ATA");
    }
  });
  it("persists a continuous route whose local walking segments stay on coarse land", () => {
    const destination = randomLandDestination(DEFAULT_HOME_CITY, 1)!;
    const state = planFrogJourney(
      { ...EMPTY_FROG_TRAVEL, pace: "preview" },
      DEFAULT_HOME_CITY,
      [destination],
      1000,
    );
    const j = { ...state.current!, route: landRoamingRoute(state.current!) };
    expect(validFrogTravel({ ...state, current: j })).toBe(true);
    expect(JSON.parse(JSON.stringify(j)).route).toEqual(j.route);
    for (let i = 0; i < 100; i++) {
      const t = j.arriveAt + ((j.returnAt - j.arriveAt) * i) / 100;
      expect(
        landAt(frogJourneyLocation(j, DEFAULT_HOME_CITY, t)!),
      ).not.toBeNull();
    }
    expect(
      frogJourneyLocation(j, DEFAULT_HOME_CITY, j.arriveAt + 1000),
    ).not.toEqual(destination.centroid);
    const shifted = shiftJourney(j, 90000);
    expect(
      frogJourneyLocation(shifted, DEFAULT_HOME_CITY, j.arriveAt + 91000),
    ).toEqual(frogJourneyLocation(j, DEFAULT_HOME_CITY, j.arriveAt + 1000));
  });
  it("crosses the date line continuously by the short longitude interval", () => {
    const p = interpolateRoute(
      [
        { lat: 10, lng: 179, at: 0, kind: "transit" },
        { lat: 10, lng: -179, at: 100, kind: "transit" },
        { lat: 35, lng: 135, at: 200, kind: "transit" },
      ],
      50,
      DEFAULT_HOME_CITY,
    )!;
    expect(Math.abs(p.lng)).toBe(180);
    expect(p.lat).toBe(10);
  });
});
