// @vitest-environment jsdom
import { act, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PoiList } from "./PoiList";
import type { WallWish } from "./model";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
  document.body.innerHTML = "";
});
describe("one persistent footprint list toggle", () => {
  it("collapses, keeps the same reachable button and reopens without changing row actions", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    const city = vi.fn(),
      wish = vi.fn();
    function Harness() {
      const [open, setOpen] = useState(true),
        ref = useRef<HTMLDivElement>(null);
      return (
        <PoiList
          groups={{
            years: [
              {
                year: 2025,
                rows: [
                  {
                    cityKey: "test-city",
                    name: "示例城市",
                    count: 3,
                    photoId: "test-image",
                  },
                ],
              },
            ],
            wished: [{ id: "test-wish", name: "示例愿望" } as WallWish],
          }}
          total={2}
          open={open}
          linked={false}
          highlightCity={null}
          highlightWish={null}
          homeCityName="示例家"
          scrollRef={ref}
          imageForPhoto={() => null}
          onToggle={() => setOpen((v) => !v)}
          onCity={city}
          onWish={wish}
          onHome={() => {}}
          onScroll={() => {}}
        />
      );
    }
    await act(async () => root!.render(<Harness />));
    const toggle = host.querySelector<HTMLButtonElement>(".poi-toggle")!;
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(host.querySelector(".poi-scroll .poi-wish-block")).not.toBeNull();
    await act(async () => toggle.click());
    expect(host.querySelector(".poi-toggle")).toBe(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.tabIndex).toBe(0);
    expect(host.querySelector<HTMLElement>("#poiContents")!.hidden).toBe(true);
    expect(city).not.toHaveBeenCalled();
    expect(wish).not.toHaveBeenCalled();
    await act(async () => toggle.click());
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(host.querySelector<HTMLElement>("#poiContents")!.hidden).toBe(false);
    await act(async () =>
      host.querySelector<HTMLButtonElement>('[data-city="test-city"]')!.click(),
    );
    await act(async () =>
      host.querySelector<HTMLButtonElement>('[data-wish="test-wish"]')!.click(),
    );
    expect(city).toHaveBeenCalledWith("test-city");
    expect(wish).toHaveBeenCalledWith("test-wish");
    expect(host.querySelector(".poi-fab")).toBeNull();
  });
});
