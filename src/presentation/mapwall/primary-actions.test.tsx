// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TopBar } from "./Chrome";
import { SearchPanel } from "./SearchPanel";
import { WaypointPanel } from "./WaypointPanel";
import { EMPTY_FROG_TRAVEL } from "../../domain/frog/journey";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
afterEach(async () => {
  await act(() => root?.unmount());
  document.body.innerHTML = "";
  root = undefined;
});
function mount() {
  const el = document.createElement("div");
  document.body.append(el);
  root = createRoot(el);
  return el;
}
function button(label: string) {
  const el = [...document.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === label,
  );
  expect(el).toBeTruthy();
  return el!;
}
describe("primary map action ownership", () => {
  it("shows missing photo attention only when needed and keeps one photo management entry", async () => {
    const host = mount(),
      manage = vi.fn(),
      noop = () => {};
    const render = (n: number) => (
      <TopBar
        missingCount={n}
        onImport={noop}
        onDrawer={manage}
        onSearch={noop}
        onTheme={noop}
        onSettings={noop}
      />
    );
    await act(() => root!.render(render(4)));
    const entry = host.querySelector<HTMLButtonElement>(
      '[aria-label="管理照片，4 张照片待补位置"]',
    )!;
    expect(entry).not.toBeNull();
    await act(() => entry.click());
    expect(manage).toHaveBeenCalledOnce();
    expect(host.querySelector(".tray")).toBeNull();
    await act(() => root!.render(render(0)));
    expect(host.querySelector(".photo-attention")).toBeNull();
    expect(host.querySelector('[aria-label="管理照片"]')).not.toBeNull();
  });
  it("starts map selection only from the explicit add action, retaining saved candidates", async () => {
    const host = mount(),
      select = vi.fn(),
      save = vi.fn();
    await act(() =>
      root!.render(
        <WaypointPanel
          state={EMPTY_FROG_TRAVEL}
          open
          selecting={false}
          draft={null}
          onOpen={() => {}}
          onSelecting={select}
          onDraft={() => {}}
          onSave={save}
          onNext={async () => {}}
          onLocate={() => {}}
          onRemove={async () => {}}
        />,
      ),
    );
    expect(host.textContent).not.toContain("在地图选点");
    expect(select).not.toHaveBeenCalled();
    await act(() => button("添加目的地").click());
    expect(select).toHaveBeenCalledWith(true);
    expect(save).not.toHaveBeenCalled();
  });
  it("adds a named offline city from search without creating a visited-photo record or needing a network request", async () => {
    const host = mount(),
      destination = vi.fn(),
      pick = vi.fn();
    function Harness() {
      const [tab, setTab] = useState<"archive" | "real">("archive");
      return (
        <SearchPanel
          open
          items={[]}
          tab={tab}
          onTab={setTab}
          realPlaces={<p>附近查询</p>}
          onClose={() => {}}
          onPick={pick}
          onDestination={destination}
          onLocate={() => {}}
        />
      );
    }
    await act(() => root!.render(<Harness />));
    const input = host.querySelector<HTMLInputElement>("input")!;
    await act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(input, "巴黎");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(() => button("添加到蛙蛙目的地").click());
    expect(destination).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "巴黎",
        country: "法国",
        source: "map",
        lat: 48.8566,
        lng: 2.3522,
      }),
    );
    expect(pick).not.toHaveBeenCalled();
  });
});
