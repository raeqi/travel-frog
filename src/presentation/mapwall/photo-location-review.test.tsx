// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Drawer, type DrawerProps } from "./Drawer";
import { PhotoLocationPicker } from "./PhotoLocationPicker";
import { photoLocationReference } from "./photo-location-start";
import { createPhoto, type Photo } from "../../domain/photo/photo";
import type { ImportBatchId } from "../../domain/common/ids";
import { makeGeoPoint } from "../../domain/geo/geo-point";
import { GazetteerCityResolver } from "../../infrastructure/geo/city-resolver";
import type { LocationSuggestion } from "../../domain/services/fill-locations";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
afterEach(async () => {
  await act(() => root?.unmount());
  root = undefined;
  document.body.innerHTML = "";
});
function photo(id: string): Photo {
  const p = createPhoto({
    id,
    importBatchId: "synthetic-batch" as ImportBatchId,
    fileName: `synthetic-${id}.jpg`,
    mimeType: "image/jpeg",
    byteSize: 100,
    contentHash: null,
    capturedAt: 1746230400000,
    capturedAtSource: "manual",
    captureOffsetMinutes: 540,
    offsetSource: "geo-approx",
    originalCapturedAt: null,
    geo: null,
    locationSource: "none",
    thumbRef: null,
    origin: "demo",
    importedAt: 1746230400000,
    issues: [],
  });
  if (!p.ok) throw new Error("fixture");
  return p.value;
}
const a = photo("a"),
  b = photo("b"),
  ignored = { ...photo("ignored"), ignored: true };
const g = makeGeoPoint({
  lat: 35.0123456789,
  lng: 135.7654321987,
  source: "candidate",
  approximate: true,
});
if (!g.ok) throw new Error("fixture");
const city = new GazetteerCityResolver().resolveByName("京都")!;
const suggestion: LocationSuggestion = {
  photoId: a.id,
  geo: g.value,
  cityRef: city,
  reason: "same-day-gps",
  sourcePhotoIds: ["source"],
  timeDeltaMs: 1000,
  distanceKm: 0,
  confidence: "high",
};
function mount() {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  return host;
}
function props(overrides: Partial<DrawerProps> = {}): DrawerProps {
  return {
    open: true,
    tab: "fill",
    onTab: () => {},
    onClose: () => {},
    candidates: [],
    batches: [],
    issues: [],
    suggestions: [suggestion, { ...suggestion, photoId: ignored.id }],
    photosById: new Map([a, b, ignored].map((p) => [p.id, p])),
    onImportFiles: async () => ({
      imported: 0,
      issues: [],
      duplicates: 0,
      failed: 0,
      candidateCount: 0,
      batchId: "batch",
    }),
    onConfirmCandidate: async () => {},
    onIgnoreCandidate: async () => {},
    onMergeCandidates: async () => {},
    onSplitCandidate: async () => {},
    onApplySuggestions: async () => {},
    onPickPhotoLocation: () => {},
    ...overrides,
  };
}
function button(label: string) {
  const found = [...document.querySelectorAll("button")].find(
    (e) => e.textContent?.trim() === label,
  );
  expect(found).toBeTruthy();
  return found!;
}
describe("one row per unlocated photo", () => {
  it("keeps suggestions inline, applies only selected eligible IDs and excludes ignored/stale suggestions", async () => {
    const host = mount(),
      apply = vi.fn(async () => {}),
      pick = vi.fn();
    await act(() =>
      root!.render(
        <Drawer
          {...props({ onApplySuggestions: apply, onPickPhotoLocation: pick })}
        />,
      ),
    );
    expect(
      [...host.querySelectorAll("[data-location-photo]")].map((e) =>
        e.getAttribute("data-location-photo"),
      ),
    ).toEqual([a.id, b.id]);
    expect(
      host.querySelectorAll(".location-photo-heading strong"),
    ).toHaveLength(2);
    expect(host.querySelector(".fill-groups")).toBeNull();
    const selectAll = host.querySelector<HTMLInputElement>(
      '[aria-label="全选 1 张有建议的照片"]',
    )!;
    await act(() => selectAll.click());
    await act(() => button("为所选 1 张应用建议").click());
    expect(apply).toHaveBeenCalledExactlyOnceWith([a.id]);
    await act(() =>
      host
        .querySelector<HTMLElement>(`[data-location-photo="${b.id}"]`)!
        .querySelector("button")!
        .click(),
    );
    expect(pick).toHaveBeenCalledWith([b.id], "fill");
  });
  it("keeps a failed suggestion selected and shows a visible failure rather than reporting completion", async () => {
    const host = mount(),
      apply = vi.fn(async () => {
        throw new Error("合成写入失败");
      });
    await act(() =>
      root!.render(<Drawer {...props({ onApplySuggestions: apply })} />),
    );
    await act(() =>
      host
        .querySelector<HTMLInputElement>(
          '[aria-label="全选 1 张有建议的照片"]',
        )!
        .click(),
    );
    await act(() => button("为所选 1 张应用建议").click());
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(
      "合成写入失败",
    );
    expect(
      host.querySelector<HTMLInputElement>(
        '[aria-label="全选 1 张有建议的照片"]',
      )!.checked,
    ).toBe(true);
  });
  it("restores the previous list scroll position after opening and canceling map picking", async () => {
    const host = mount(),
      base = props();
    await act(() => root!.render(<Drawer {...base} />));
    const body = host.querySelector<HTMLElement>(".drawer-body")!;
    await act(() => {
      body.scrollTop = 246;
      body.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    await act(() => root!.render(<Drawer {...base} open={false} />));
    await act(() => root!.render(<Drawer {...base} />));
    expect(host.querySelector<HTMLElement>(".drawer-body")!.scrollTop).toBe(
      246,
    );
  });
});
describe("reference view is separate from confirmed coordinates", () => {
  it("starts the selected Kyoto photo at the exact suggestion, and leaves no-suggestion records without a fabricated reference", () => {
    expect(photoLocationReference([a.id], [a, b], [suggestion])).toEqual({
      lat: g.value.lat,
      lng: g.value.lng,
      label: "京都",
      kind: "suggestion",
    });
    expect(photoLocationReference([b.id], [a, b], [suggestion])).toBeNull();
    expect(a.geo).toBeNull();
  });
  it("searching for a city only requests a view change and never saves the photo", async () => {
    const host = mount(),
      search = vi.fn(),
      save = vi.fn(async () => {});
    await act(() =>
      root!.render(
        <PhotoLocationPicker
          photos={[b]}
          draft={null}
          onSave={save}
          onCancel={() => {}}
          onRepick={() => {}}
          load={async () => null}
          onSearchPlace={search}
        />,
      ),
    );
    const input = host.querySelector<HTMLInputElement>(
      '[aria-label="搜索照片拍摄城市"]',
    )!;
    await act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(input, "京都");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(() => button("查看京都附近 · 日本").click());
    expect(search).toHaveBeenCalledWith({
      name: "京都",
      lat: city.centroid!.lat,
      lng: city.centroid!.lng,
    });
    expect(save).not.toHaveBeenCalled();
  });
});
