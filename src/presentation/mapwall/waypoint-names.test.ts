import { describe, expect, it } from "vitest";
import { GazetteerCityResolver } from "../../infrastructure/geo/city-resolver";
import { namedMapPoint, nearbyWaypointCity } from "./waypoint-names";

describe("offline names for the selected point", () => {
  it("suggests the nearby city while retaining the exact clicked point rather than the city centre", () => {
    const point = { lat: 48.85822222, lng: 2.2945 };
    const draft = namedMapPoint(point, new GazetteerCityResolver());
    expect(draft.name).toBe("巴黎附近");
    expect(draft.lat).toBe(point.lat);
    expect(draft.lng).toBe(point.lng);
    expect(draft.lng).not.toBe(nearbyWaypointCity(point)!.centroid!.lng);
  });
  it("uses a neutral editable name when there is no nearby gazetteer city", () => {
    const point = { lat: 0, lng: -140 };
    expect(nearbyWaypointCity(point)).toBeNull();
    expect(namedMapPoint(point)).toMatchObject({
      ...point,
      name: "想去的地方",
      source: "map",
    });
    expect(namedMapPoint(point).name).not.toMatch(/\d/);
  });
});
