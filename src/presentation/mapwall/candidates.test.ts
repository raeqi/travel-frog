import { describe, expect, it } from "vitest";
import { cityKey } from "../../domain/city/city-ref";
import { DEST_CANDIDATES, availableDestinations } from "./candidates";

describe("destination candidates", () => {
  it("uses the canonical city key for every destination", () => {
    for (const destination of DEST_CANDIDATES) {
      expect(destination.key).toBe(
        cityKey(destination.countryCode, destination.name),
      );
    }
  });

  it("has unique keys", () => {
    const keys = DEST_CANDIDATES.map((destination) => destination.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("drops cities that already have a confirmed trip", () => {
    const visited = new Set([cityKey("JPN", "金泽")]);
    const keys = availableDestinations({
      visitedCityKeys: visited,
      activeWishCityKeys: [],
    }).map((destination) => destination.key);
    expect(keys).not.toContain(cityKey("JPN", "金泽"));
    expect(keys).toContain(cityKey("KOR", "首尔"));
  });

  it("drops cities that already have an active postcard", () => {
    const keys = availableDestinations({
      visitedCityKeys: [],
      activeWishCityKeys: [cityKey("KOR", "首尔")],
    }).map((destination) => destination.key);
    expect(keys).not.toContain(cityKey("KOR", "首尔"));
  });

  it("matches normalized names so spacing and case do not leak duplicates", () => {
    const keys = availableDestinations({
      visitedCityKeys: [cityKey("jpn", "  金泽 ")],
      activeWishCityKeys: [],
    }).map((destination) => destination.key);
    expect(keys).not.toContain(cityKey("JPN", "金泽"));
  });

  it("offers a declined destination again because the caller leaves it out of the blocked sets", () => {
    const keys = availableDestinations({
      visitedCityKeys: [],
      activeWishCityKeys: [],
    }).map((destination) => destination.key);
    expect(keys).toContain(cityKey("JPN", "金泽"));
  });
});

it("resolves GPS imports for every offered destination to the postcard city key", async () => {
  const { GazetteerCityResolver } = await import(
    "../../infrastructure/geo/city-resolver"
  );
  const { DEST_CANDIDATES } = await import("./candidates");
  const resolver = new GazetteerCityResolver();
  for (const destination of DEST_CANDIDATES) {
    const resolved = resolver.resolve({
      lat: destination.lat,
      lng: destination.lng,
      source: "exif",
      approximate: false,
      accuracyM: null,
    });
    expect(resolved?.key).toBe(destination.key);
  }
});
