import { describe, expect, it } from "vitest";
import { DEFAULT_HOME_CITY } from "../home/home";
import { FROG_DESTINATIONS } from "./destinations";
import {
  EMPTY_FROG_TRAVEL,
  advanceFrogJourney,
  chooseFrogDestination,
  frogJourneyLocation,
  journeyAway,
  journeyPhase,
  planFrogJourney,
  validFrogTravel,
} from "./journey";
const NOW = Date.UTC(2026, 10, 18, 9);
const planned = () =>
  planFrogJourney(EMPTY_FROG_TRAVEL, DEFAULT_HOME_CITY, FROG_DESTINATIONS, NOW);
describe("autonomous frog itinerary", () => {
  it("chooses a reproducible journey without user photos or direction", () => {
    const a = planned();
    expect(a).toEqual(planned());
    expect(a.current?.source).toBe("autonomous");
    expect(a.current?.destination.key).not.toBe(DEFAULT_HOME_CITY.key);
    expect(validFrogTravel(a)).toBe(true);
    expect(a.current!.homeAt - a.current!.departAt).toBeGreaterThan(
      2 * 3600_000,
    );
  });
  it("separates packing, outward travel, visit and return, and leaves home only after departure", () => {
    const j = planned().current!;
    expect(journeyPhase(j, NOW)).toBe("resting");
    expect(journeyPhase(j, j.prepareAt)).toBe("packing");
    expect(journeyPhase(j, j.departAt)).toBe("outbound");
    expect(journeyPhase(j, j.arriveAt)).toBe("visiting");
    expect(journeyPhase(j, j.returnAt)).toBe("returning");
    expect(journeyAway(j, j.prepareAt)).toBe(false);
    expect(journeyAway(j, j.departAt)).toBe(true);
    expect(frogJourneyLocation(j, DEFAULT_HOME_CITY, j.arriveAt)?.lat).toBe(
      j.destination.centroid?.lat,
    );
    expect(frogJourneyLocation(j, DEFAULT_HOME_CITY, j.homeAt)?.lat).toBe(
      DEFAULT_HOME_CITY.centroid?.lat,
    );
  });
  it("catches up one saved trip after a long absence and schedules the next after reopening", () => {
    const state = planned(),
      j = state.current!,
      later = j.homeAt + 90 * 86400_000;
    const next = advanceFrogJourney(
      state,
      DEFAULT_HOME_CITY,
      FROG_DESTINATIONS,
      later,
    );
    expect(next.returned).toBe(true);
    expect(next.state.history).toHaveLength(1);
    expect(next.state.sequence).toBe(2);
    expect(next.state.current!.prepareAt).toBeGreaterThan(later);
    const again = advanceFrogJourney(
      next.state,
      DEFAULT_HOME_CITY,
      FROG_DESTINATIONS,
      later,
    );
    expect(again.letter).toBeNull();
    expect(again.state).toBe(next.state);
  });
  it("records a letter once and sometimes plans a journey without a letter", () => {
    const state = planned(),
      j = state.current!;
    const next = advanceFrogJourney(
      state,
      DEFAULT_HOME_CITY,
      FROG_DESTINATIONS,
      j.letterAt!,
    );
    expect(next.letter?.id).toBe(j.id);
    expect(
      advanceFrogJourney(
        next.state,
        DEFAULT_HOME_CITY,
        FROG_DESTINATIONS,
        j.letterAt!,
      ).letter,
    ).toBeNull();
    const third = planFrogJourney(
      {
        ...EMPTY_FROG_TRAVEL,
        sequence: 2,
        history: [j, { ...j, id: "frog-journey-2", number: 2 }],
      },
      DEFAULT_HOME_CITY,
      FROG_DESTINATIONS,
      NOW,
    );
    expect(third.current?.letterAt).toBeNull();
    expect(third.current?.wishId).toBeNull();
  });
  it("avoids the recent destination and labels the separate accelerated pace", () => {
    const state = planned(),
      j = state.current!;
    expect(
      chooseFrogDestination(
        { ...state, current: null, history: [j] },
        DEFAULT_HOME_CITY,
        FROG_DESTINATIONS,
      )?.key,
    ).not.toBe(j.destination.key);
    const fast = planFrogJourney(
      { ...EMPTY_FROG_TRAVEL, pace: "preview" },
      DEFAULT_HOME_CITY,
      FROG_DESTINATIONS,
      NOW,
      true,
    ).current!;
    expect(fast.pace).toBe("preview");
    expect(fast.homeAt - NOW).toBeLessThan(60_000);
    expect(fast.homeAt - NOW).toBeGreaterThan(30_000);
  });
  it("rejects malformed saved itineraries rather than displaying a fabricated valid state", () => {
    const state = planned();
    expect(
      validFrogTravel({
        ...state,
        current: { ...state.current!, homeAt: NOW },
      }),
    ).toBe(false);
    expect(validFrogTravel({ ...state, sequence: NaN })).toBe(false);
  });
  it("does not count a cancelled or replanned itinerary as a completed trip", () => {
    const first = planned();
    const replanned = planFrogJourney(
      { ...first, current: null, pace: "preview" },
      DEFAULT_HOME_CITY,
      FROG_DESTINATIONS,
      NOW,
      true,
    );
    expect(replanned.current!.id).not.toBe(first.current!.id);
    expect(replanned.current!.wishId).not.toBe(first.current!.wishId);
    expect(replanned.current!.number).toBe(1);
    expect(replanned.current!.note).toContain("第1趟");
  });
});
