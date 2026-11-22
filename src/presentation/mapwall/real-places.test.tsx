/// <reference types="node" />
// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RealPlaces, RealPlacePins } from "./RealPlaces";
import { useRealPlaces } from "./useRealPlaces";
import { projectWorld } from "./geometry";
import { parseWikiPois, wikiQueryUrl } from "./wiki-pois";
import { poiSourceUrl } from "./real-pois";
const payload = JSON.parse(
  readFileSync("src/presentation/mapwall/fixtures/wiki-paris.json", "utf8"),
);
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
afterEach(async () => {
  if (root) await act(() => root!.unmount());
  root = undefined;
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});
async function click(text: string) {
  const button = [...document.querySelectorAll("button")].find(
    (b) => b.textContent === text,
  );
  expect(button).toBeTruthy();
  await act(async () => {
    button!.click();
  });
}
describe("live-source places response and clickable UI", () => {
  it("parses a recorded HTTP200 Wikipedia response and rejects invalid globe, IDs and coordinates", () => {
    const parsed = parseWikiPois(payload);
    expect(parsed.length).toBe(50);
    expect(parsed.find((p) => p.id === "wikipedia/9232")).toMatchObject({
      name: "艾菲爾鐵塔",
      lat: 48.85822222,
      lng: 2.2945,
    });
    expect(
      parseWikiPois({
        batchcomplete: "",
        query: { pages: { a: { pageid: -1, ns: 0, title: "wrong" } } },
      }),
    ).toEqual([]);
    expect(() => parseWikiPois({ error: { code: "ratelimited" } })).toThrow();
    expect(wikiQueryUrl({ lat: 48.858, lng: 2.295, radius: 1500 })).toContain(
      "ggslimit=50",
    );
    expect(() => wikiQueryUrl({ lat: NaN, lng: 0, radius: 1500 })).toThrow();
    expect(poiSourceUrl(parsed.find((p) => p.id === "wikipedia/9232")!)).toBe(
      "https://en.wikipedia.org/?curid=9232",
    );
  });
  it("queries only after explicit action, pins a returned name, and opens its source-backed detail", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => payload });
    vi.stubGlobal("fetch", fetch);
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    const point = projectWorld(48.858, 2.295);
    const area = { lat: 48.858, lng: 2.295, radius: 1500 };
    const save = vi.fn();
    function Harness() {
      const places = useRealPlaces(area),
        [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen((v) => !v)}>搜索地点</button>
          <RealPlacePins
            pois={places.pois}
            camera={{ cx: point.x, cy: point.y, zoom: 4500 }}
            metrics={{
              boardW: 1200,
              boardH: 800,
              sheetW: 1000,
              sheetH: 640,
              offX: 100,
              offY: 80,
            }}
            project={projectWorld}
            onSelect={(p) => {
              places.setSelected(p);
              setOpen(true);
            }}
          />
          {open && <RealPlaces places={places} area={area} onSave={save} />}
        </>
      );
    }
    await act(async () => root!.render(<Harness />));
    expect(fetch).not.toHaveBeenCalled();
    await click("搜索地点");
    expect(fetch).not.toHaveBeenCalled();
    expect(host.textContent).toContain("en.wikipedia.org");
    await click("查询当前区域");
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
    await click("搜索地点");
    expect(host.querySelector(".real-places")).toBeNull();
    const pin = host.querySelector(
      'button[aria-label="地点：艾菲爾鐵塔"]',
    ) as HTMLButtonElement;
    expect(pin).toBeTruthy();
    await act(async () => pin.click());
    expect(host.querySelector(".real-place-detail h3")?.textContent).toBe(
      "艾菲爾鐵塔",
    );
    expect(
      host.querySelector(".real-place-detail a")?.getAttribute("href"),
    ).toBe("https://en.wikipedia.org/?curid=9232");
    expect(host.textContent).toContain("48.85822");
    expect(host.textContent).toContain("不代表完整商户目录");
    await click("添加到蛙蛙目的地");
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "wikipedia/9232",
        name: "艾菲爾鐵塔",
        lat: 48.85822222,
        lng: 2.2945,
      }),
    );
    expect(fetch).toHaveBeenCalledOnce();
  });
});
