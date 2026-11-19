// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { PhotoLocationPicker } from "./PhotoLocationPicker";
import { Drawer } from "./Drawer";
import type { Photo } from "../../domain/photo/photo";
import { namedMapPoint } from "./waypoint-names";
import { DEFAULT_HOME_CITY } from '../../domain/home/home';
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
  document.body.innerHTML = "";
});
function mount() {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  return host;
}
const photo = {
  id: "original-photo-id",
  fileName: "unique-synthetic.jpg",
  thumbRef: "saved-thumbnail",
  geo: null,
  ignored: false,
  tripId: null,
} as Photo;
describe("photo map location confirmation", () => {
  it('keeps existing suggested locations usable in one click without opening the map',async()=>{
    const host=mount(),apply=vi.fn(async()=>{}),pick=vi.fn();
    const target={...photo,capturedAt:Date.UTC(2024,4,2),captureOffsetMinutes:0} as Photo;
    await act(async()=>root!.render(<Drawer open tab="fill" onTab={()=>{}} onClose={()=>{}} candidates={[]} batches={[]} issues={[]} suggestions={[{photoId:photo.id,geo:DEFAULT_HOME_CITY.centroid!,cityRef:DEFAULT_HOME_CITY,reason:'same-day-gps',sourcePhotoIds:['located'],timeDeltaMs:1,distanceKm:0,confidence:'high'}]} photosById={new Map([[photo.id,target]])} onImportFiles={async()=>{throw new Error('not used');}} onConfirmCandidate={async()=>{}} onIgnoreCandidate={async()=>{}} onMergeCandidates={async()=>{}} onSplitCandidate={async()=>{}} onApplySuggestions={apply} onPickPhotoLocation={pick}/>));
    await act(async()=>[...host.querySelectorAll('button')].find(e=>e.textContent==='全部套用')!.dispatchEvent(new MouseEvent('click',{bubbles:true})));
    expect(apply).toHaveBeenCalledWith([photo.id]);expect(pick).not.toHaveBeenCalled();
  });
  it("requires a map pick, never asks for numbers initially, and cancels without saving", async () => {
    const host = mount(),
      save = vi.fn(async () => {}),
      cancel = vi.fn();
    await act(async () =>
      root!.render(
        <PhotoLocationPicker
          photos={[photo]}
          draft={null}
          onSave={save}
          onCancel={cancel}
          onRepick={() => {}}
          load={async () => null}
        />,
      ),
    );
    expect(host.querySelector("input")).toBeNull();
    expect(host.textContent).toContain("请先在地图轻点一个位置");
    await act(async () =>
      host
        .querySelector("header button")!
        .dispatchEvent(new MouseEvent("click", { bubbles: true })),
    );
    expect(cancel).toHaveBeenCalledOnce();
    expect(save).not.toHaveBeenCalled();
  });
  it("confirms a custom name with the clicked position without snapping to the nearby city", async () => {
    const host = mount(),
      save = vi.fn(async () => {}),
      draft = namedMapPoint({ lat: 48.849849, lng: 2.318185 });
    await act(async () =>
      root!.render(
        <PhotoLocationPicker
          photos={[photo]}
          draft={draft}
          onSave={save}
          onCancel={() => {}}
          onRepick={() => {}}
          load={async () => null}
        />,
      ),
    );
    expect(host.querySelector("details")!.open).toBe(false);
    expect(
      [...host.querySelectorAll("input")]
        .filter((e) => !e.closest("details"))
        .map((e) => e.name),
    ).toEqual(["name"]);
    host.querySelector<HTMLInputElement>("input[name=name]")!.value =
      "我的拍摄地点";
    await act(async () =>
      host
        .querySelector("form")!
        .dispatchEvent(
          new SubmitEvent("submit", { bubbles: true, cancelable: true }),
        ),
    );
    expect(save).toHaveBeenCalledWith({
      name: "我的拍摄地点",
      country: draft.country,
      lat: 48.849849,
      lng: 2.318185,
    });
  });
  it("enters the shared map from an existing unlocated archive photo instead of the numeric form", async () => {
    const host = mount(),
      pick = vi.fn(),
      archived = { ...photo, tripId: "existing-trip" } as Photo;
    await act(async () =>
      root!.render(
        <Drawer
          open
          tab="fill"
          onTab={() => {}}
          onClose={() => {}}
          candidates={[]}
          batches={[]}
          issues={[]}
          suggestions={[]}
          photosById={new Map([[photo.id, archived]])}
          onImportFiles={async () => {
            throw new Error("not used");
          }}
          onConfirmCandidate={async () => {}}
          onIgnoreCandidate={async () => {}}
          onMergeCandidates={async () => {}}
          onSplitCandidate={async () => {}}
          onApplySuggestions={async () => {}}
          onPickPhotoLocation={pick}
        />,
      ),
    );
    const button = [...host.querySelectorAll("button")].find(
      (e) => e.textContent === "在地图选位置",
    )!;
    await act(async () =>
      button.dispatchEvent(new MouseEvent("click", { bubbles: true })),
    );
    expect(pick).toHaveBeenCalledWith([photo.id], "fill");
    expect(host.querySelector('form[aria-label="手动补位置"]')).toBeNull();
  });
});
