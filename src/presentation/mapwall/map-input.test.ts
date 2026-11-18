import { describe, expect, it } from "vitest";
import { boundCamera, panCamera, zoomCamera } from "./map-gestures";
import { parsePois, poiArea, poiQuery } from "./real-pois";
import { projectWorld, toScreen, type Metrics } from "./geometry";
const metrics: Metrics = {
  boardW: 1200,
  boardH: 800,
  sheetW: 1000,
  sheetH: 640,
  offX: 100,
  offY: 80,
};
describe("direct map input", () => {
  it("moves geographical features exactly with the finger", () => {
    const camera = { cx: 500, cy: 320, zoom: 4 },
      point = projectWorld(10, 20);
    const before = toScreen(point, camera, metrics);
    const after = toScreen(
      point,
      panCamera(camera, 123, -44, metrics, 60),
      metrics,
    );
    expect(after.x - before.x).toBeCloseTo(123);
    expect(after.y - before.y).toBeCloseTo(-44);
  });
  it("keeps the coordinate under the zoom anchor stationary", () => {
    const camera = { cx: 500, cy: 320, zoom: 4 },
      point = { x: 530, y: 295 };
    const before = toScreen(point, camera, metrics),
      next = zoomCamera(camera, 2, before.x, before.y, metrics, 60);
    const after = toScreen(point, next, metrics);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });
  it("constrains the world edge and extreme wheel zoom", () => {
    expect(boundCamera({ cx: -999, cy: 9999, zoom: 0.1 }, metrics, 60)).toEqual(
      { cx: 375, cy: 400, zoom: 0.8 },
    );
    const edge = panCamera(
      { cx: 500, cy: 320, zoom: 2 },
      10000,
      10000,
      metrics,
      60,
    );
    expect(edge).toEqual({ cx: 150, cy: 96, zoom: 2 });
    expect(zoomCamera(edge, 1e9, 500, 320, metrics, 60).zoom).toBe(60);
  });
});
describe("source-backed real places", () => {
  it("rounds only the selected map centre and blocks wide-area queries", () => {
    expect(poiArea({ cx: 500, cy: 320, zoom: 1 }, metrics, "world")).toBeNull();
    const p = projectWorld(48.8584123, 2.2945123);
    expect(poiArea({ cx: p.x, cy: p.y, zoom: 3000 }, metrics, "world")).toEqual(
      { lat: 48.858, lng: 2.295, radius: 1500 },
    );
    expect(poiArea({ cx: 500, cy: 320, zoom: 1 }, metrics, "city")?.lng).toBe(
      135.768,
    );
  });
  it("limits the API query, validates numbers and includes no archive data", () => {
    const query = poiQuery({ lat: 48.858, lng: 2.295, radius: 1500 });
    expect(query).toContain("out center qt 80");
    expect(query).toContain("[timeout:20]");
    expect(query).toContain("around:1500,48.858,2.295");
    expect(() => poiQuery({ lat: NaN, lng: 0, radius: 1500 })).toThrow();
    expect(() => poiQuery({ lat: 0, lng: 0, radius: 500000 })).toThrow();
  });
  it("uses returned names and coordinates, rejects malformed or fabricated fallbacks", () => {
    const result = parsePois({
      elements: [
        {
          type: "node",
          id: 1,
          lat: 48.85,
          lon: 2.29,
          tags: {
            name: "Tour Eiffel",
            "name:zh": "埃菲尔铁塔",
            tourism: "attraction",
          },
        },
        {
          type: "way",
          id: 2,
          center: { lat: 48.86, lon: 2.3 },
          tags: { name: "Museum", tourism: "museum" },
        },
        { type: "node", id: 3, lat: 48.85, lon: 2.29, tags: {} },
        { type: "node", id: 4, lat: 999, lon: 2.29, tags: { name: "invalid" } },
        {
          type: "file",
          id: 5,
          lat: 48.85,
          lon: 2.29,
          tags: { name: "invalid" },
        },
      ],
    });
    expect(result.map((p) => p.name)).toEqual(["埃菲尔铁塔", "Museum"]);
    expect(result[1]?.id).toBe("way/2");
    expect(parsePois({ elements: [] })).toEqual([]);
    expect(() => parsePois({ error: "overloaded" })).toThrow();
  });
});
