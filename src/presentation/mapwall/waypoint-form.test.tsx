// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { EMPTY_FROG_TRAVEL } from "../../domain/frog/journey";
import { WaypointPanel } from "./WaypointPanel";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
  document.body.innerHTML = "";
});
describe("editable native coordinate form", () => {
  it("submits actual coordinates and the selected next-stop action, preserving the record being edited", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    const save = vi.fn(async () => {}),
      noop = () => {};
    await act(async () =>
      root!.render(
        <WaypointPanel
          state={EMPTY_FROG_TRAVEL}
          open
          selecting={false}
          draft={{
            id: "existing",
            name: "旧名称",
            country: "",
            lat: 1,
            lng: 2,
            source: "map",
          }}
          onOpen={noop}
          onSelecting={noop}
          onDraft={noop}
          onSave={save}
          onNext={async () => {}}
          onLocate={noop}
          onRemove={async () => {}}
        />,
      ),
    );
    for (const [name, value] of Object.entries({
      name: "自定义点",
      country: "测试区域",
      lat: "0",
      lng: "3.654321",
    }))
      host.querySelector<HTMLInputElement>(`input[name="${name}"]`)!.value =
        value;
    const submitter = host.querySelector<HTMLButtonElement>(
      'button[value="next"]',
    )!;
    await act(async () =>
      host
        .querySelector("form")!
        .dispatchEvent(
          new SubmitEvent("submit", {
            bubbles: true,
            cancelable: true,
            submitter,
          }),
        ),
    );
    expect(save).toHaveBeenCalledWith(
      {
        id: "existing",
        name: "自定义点",
        country: "测试区域",
        lat: 0,
        lng: 3.654321,
        source: "map",
      },
      true,
    );
  });
});
