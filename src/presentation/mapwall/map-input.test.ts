import { describe, expect, it } from "vitest";
import { boundCamera, panCamera, zoomCamera } from "./map-gestures";
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
