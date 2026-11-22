// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { CityRef } from "../../domain/city/city-ref";
import type { Photo } from "../../domain/photo/photo";
import type { LocationSuggestion } from "../../domain/services/fill-locations";
import { PhotoLocationInbox } from "./PhotoLocationInbox";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;

afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
  document.body.innerHTML = "";
});

function mount(): HTMLElement {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  return host;
}

function city(): CityRef {
  return {
    key: "FRA:巴黎",
    name: "巴黎",
    countryCode: "FRA",
    countryName: "法国",
    centroid: {
      lat: 48.85,
      lng: 2.35,
      accuracyM: null,
      source: "candidate",
      approximate: true,
    },
    source: "gazetteer",
    confidence: "high",
  };
}

function photo(id: string, fileName: string): Photo {
  return {
    id,
    fileName,
    thumbRef: null,
    geo: null,
    ignored: false,
    tripId: null,
    capturedAt: Date.UTC(2026, 4, 2, 10),
    captureOffsetMinutes: 0,
  } as unknown as Photo;
}

function suggestion(photoId: string): LocationSuggestion {
  return {
    photoId,
    geo: {
      lat: 48.86,
      lng: 2.29,
      accuracyM: null,
      source: "candidate",
      approximate: true,
    },
    cityRef: city(),
    reason: "same-day-gps",
    sourcePhotoIds: ["located"],
    timeDeltaMs: 1000,
    distanceKm: 0,
    confidence: "high",
  };
}

async function renderInbox(
  overrides: Partial<ComponentProps<typeof PhotoLocationInbox>> = {},
) {
  const onTag = vi.fn();
  const onApplySuggestions = vi.fn(async () => {});
  const onClose = vi.fn();
  const props: ComponentProps<typeof PhotoLocationInbox> = {
    photos: [photo("p1", "a.jpg"), photo("p2", "b.jpg")],
    locatedCount: 3,
    withoutLocation: 2,
    suggestions: [suggestion("p1")],
    candidates: [],
    trips: [],
    filterCandidateId: null,
    filterCandidateTitle: undefined,
    load: async () => null,
    onTag,
    onApplySuggestions,
    onClose,
    ...overrides,
  };
  const host = mount();
  await act(async () => {
    root!.render(<PhotoLocationInbox {...props} />);
  });
  return { host, onTag, onApplySuggestions, onClose };
}

function click(host: HTMLElement, text: string) {
  const button = [...host.querySelectorAll("button")].find((item) =>
    item.textContent?.includes(text),
  );
  if (!button) throw new Error(`button not found: ${text}`);
  return act(async () =>
    button.dispatchEvent(new MouseEvent("click", { bubbles: true })),
  );
}

describe("photo location workbench", () => {
  it("shows counts, thumbnails, suggestion and both one-photo actions", async () => {
    const { host, onTag, onApplySuggestions } = await renderInbox();
    expect(host.textContent).toContain("已定位 3 张");
    expect(host.textContent).toContain("缺位置 2 张");
    expect(host.textContent).toContain("有同日建议 1 张");
    expect(host.textContent).toContain("a.jpg");
    expect(host.textContent).toContain("巴黎");
    await click(host, "用这个位置");
    expect(onApplySuggestions).toHaveBeenCalledWith(["p1"]);
    await click(host, "在地图标记");
    expect(onTag).toHaveBeenCalledWith(["p1"]);
  });

  it("can select several photos and mark them with one location", async () => {
    const { host, onTag } = await renderInbox();
    const boxes = [...host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    expect(boxes).toHaveLength(2);
    await act(async () => {
      for (const box of boxes) box.click();
    });
    expect(host.textContent).toContain("已选 2 张");
    await click(host, "给所选 2 张标记同一位置");
    expect(onTag).toHaveBeenCalledWith(["p1", "p2"]);
  });

  it("shows the candidate filter and offers the candidate confirmation when done", async () => {
    const onGoCandidates = vi.fn();
    const first = await renderInbox({
      photos: [],
      filterCandidateId: "cand_1",
      filterCandidateTitle: "京都",
      onGoCandidates,
      onClearFilter: () => {},
    });
    expect(first.host.textContent).toContain("只显示候选");
    expect(first.host.textContent).toContain("京都");
    expect(first.host.textContent).toContain("这组照片都已经有位置了");
    await click(first.host, "去确认候选");
    expect(onGoCandidates).toHaveBeenCalledOnce();
  });

  it("applies all high-confidence suggestions only after an explicit click", async () => {
    const { host, onApplySuggestions } = await renderInbox({
      photos: [photo("p1", "a.jpg"), photo("p2", "b.jpg"), photo("p3", "c.jpg")],
      suggestions: [suggestion("p1"), suggestion("p3")],
    });
    expect(onApplySuggestions).not.toHaveBeenCalled();
    await click(host, "套用高置信建议（2）");
    expect(onApplySuggestions).toHaveBeenCalledWith(["p1", "p3"]);
  });
});
