// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const callbacks = vi.hoisted(() => ({
  map: {} as Record<string, (event?: unknown) => void>,
  tiles: {} as Record<string, () => void>,
}));
vi.mock("leaflet", () => ({
  map: () => ({
    setView() {
      return this;
    },
    on(name: string, callback: (event?: unknown) => void) {
      callbacks.map[name] = callback;
      return this;
    },
    getCenter: () => ({ lat: 35.0123456789, lng: 135.7654321987 }),
    getSize: () => ({ y: 600 }),
    panInside() {},
    invalidateSize() {},
    remove() {},
  }),
  control: {
    zoom: () => ({ addTo() {} }),
    attribution: () => ({ addTo() {} }),
  },
  tileLayer: () => ({
    on(name: string, callback: () => void) {
      callbacks.tiles[name] = callback;
      return this;
    },
    addTo() {
      return this;
    },
  }),
  circleMarker: () => ({
    addTo() {
      return this;
    },
    remove() {},
  }),
}));
import { DetailedPhotoMap } from "./DetailedPhotoMap";
import { detailMapPoint } from "./detail-map-point";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
beforeEach(() => {
  callbacks.map = {};
  callbacks.tiles = {};
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(async () => {
  await act(() => root?.unmount());
  root = undefined;
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function mount() {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  return host;
}
describe("photo street basemap boundaries", () => {
  it("preserves clicked coordinates and does not turn the tail of a drag into a new selection", async () => {
    mount();
    const pick = vi.fn(),
      now = vi.spyOn(performance, "now").mockReturnValue(1000);
    const point = { lat: 35.0123456789, lng: 135.7654321987 };
    await act(() =>
      root!.render(
        <DetailedPhotoMap
          initialView={{ ...point, zoom: 14 }}
          reference={null}
          selected={null}
          onPick={pick}
          onExit={() => {}}
        />,
      ),
    );
    await act(() => callbacks.map.click!({ latlng: point }));
    expect(pick).toHaveBeenCalledExactlyOnceWith(point);
    callbacks.map.dragend!();
    now.mockReturnValue(1001);
    await act(() => callbacks.map.click!({ latlng: { lat: 0, lng: 0 } }));
    expect(pick).toHaveBeenCalledOnce();
    now.mockReturnValue(1400);
    await act(() => callbacks.map.click!({ latlng: { lat: 0, lng: 0 } }));
    expect(pick).toHaveBeenLastCalledWith({ lat: 0, lng: 0 });
  });
  it("shows a tile failure and permits an explicit fallback without selecting or saving anything", async () => {
    const host = mount(),
      pick = vi.fn(),
      exit = vi.fn();
    await act(() =>
      root!.render(
        <DetailedPhotoMap
          initialView={{ lat: 35, lng: 135, zoom: 14 }}
          reference={null}
          selected={{ lat: 35, lng: 135 }}
          onPick={pick}
          onExit={exit}
        />,
      ),
    );
    await act(() => callbacks.tiles.tileerror!());
    expect(host.querySelector('[role="status"]')?.textContent).toContain(
      "街道底图暂不可用，照片位置未改动",
    );
    await act(() =>
      [...host.querySelectorAll("button")]
        .find((e) => e.textContent === "返回离线地图")!
        .click(),
    );
    expect(exit).toHaveBeenCalledOnce();
    expect(pick).not.toHaveBeenCalled();
  });
  it("rejects invalid points and does not round or snap a valid normal longitude", () => {
    const point = { lat: 35.0123456789, lng: 135.7654321987 };
    expect(detailMapPoint(point)).toEqual(point);
    expect(detailMapPoint({ lat: NaN, lng: 1 })).toBeNull();
    expect(detailMapPoint({ lat: 89, lng: 1 })).toBeNull();
    expect(detailMapPoint({ lat: 1, lng: 181 })).toEqual({ lat: 1, lng: -179 });
  });
});
