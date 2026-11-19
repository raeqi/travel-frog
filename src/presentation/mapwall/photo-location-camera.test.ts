import { describe, expect, it } from "vitest";
import { photoLocationCamera } from "./photo-location-camera";
import { mapCoordinate, projectWorld, toScreen } from "./geometry";
describe("phone photo pin framing", () => {
  it("shows the selected pin above the card while keeping its original coordinates", () => {
    const metrics = {
        boardW: 360,
        boardH: 566,
        sheetW: 332,
        sheetH: 528,
        offX: 14,
        offY: 20,
      },
      point = { lat: 48.86794988207547, lng: 2.292641509433963 };
    const p = projectWorld(point.lat, point.lng),
      camera = photoLocationCamera(
        point,
        { cx: p.x, cy: p.y, zoom: 3600 },
        metrics,
        "world",
      );
    const screen = toScreen(p, camera, metrics);
    expect(screen.y).toBeGreaterThan(50);
    expect(screen.y).toBeLessThan(200);
    const restored = mapCoordinate(
      screen.x,
      screen.y,
      camera,
      metrics,
      "world",
    )!;
    expect(restored.lat).toBeCloseTo(point.lat, 10);
    expect(restored.lng).toBeCloseTo(point.lng, 10);
    const world = photoLocationCamera(
      point,
      { cx: 500, cy: 320, zoom: 1 },
      metrics,
      "world",
    );
    expect(toScreen(p, world, metrics).y).toBeLessThan(200);
  });
});
