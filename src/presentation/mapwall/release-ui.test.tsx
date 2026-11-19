/// <reference types="node" />
// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { File as NodeFile } from "node:buffer";
import { act, useRef, useState, useSyncExternalStore } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { Drawer, type DrawerTab } from "./Drawer";
import { useMapGestures } from "./map-gestures";
import type { Camera } from "./geometry";
import { TravelFrogService } from "../../application/travel-frog-service";
import { openDatabase } from "../../infrastructure/persistence/idb/database";
import { IdbUnitOfWork } from "../../infrastructure/persistence/idb/unit-of-work";
import { BrowserExifReader } from "../../infrastructure/exif/exif-reader.browser";
import { BrowserFingerprintReader } from "../../infrastructure/media/fingerprint.browser";

import { GazetteerCityResolver } from "../../infrastructure/geo/city-resolver";
import { CryptoIdGenerator } from "../../infrastructure/crypto-id-generator";
import { RingBufferLogger } from "../../infrastructure/logging/ring-buffer-logger";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
afterEach(async () => {
  if (root) await act(() => root!.unmount());
  root = undefined;
  document.body.innerHTML = "";
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function mountHost() {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  return host;
}
function pointer(
  node: HTMLElement,
  type: string,
  id: number,
  x: number,
  y: number,
) {
  const e = new MouseEvent(type, {
    bubbles: true,
    button: 0,
    clientX: x,
    clientY: y,
  });
  Object.defineProperty(e, "pointerId", { value: id });
  node.dispatchEvent(e);
}

describe("direct map gesture events in a DOM", () => {
  it("pans from an archive pin, suppresses only its ghost click, and accepts a fresh click", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 16),
    );
    vi.stubGlobal("cancelAnimationFrame", clearTimeout);
    const open = vi.fn(),
      host = mountHost();
    function Harness() {
      const ref = useRef<HTMLDivElement>(null),
        [camera, setCamera] = useState<Camera>({ cx: 500, cy: 320, zoom: 2 });
      useMapGestures(
        ref,
        camera,
        {
          boardW: 1000,
          boardH: 640,
          sheetW: 1000,
          sheetH: 640,
          offX: 0,
          offY: 0,
        },
        12000,
        setCamera,
      );
      return (
        <div ref={ref} data-camera={JSON.stringify(camera)}>
          <button onClick={open}>照片</button>
        </div>
      );
    }
    await act(async () => root!.render(<Harness />));
    const board = host.firstElementChild as HTMLDivElement,
      pin = board.querySelector("button")!;
    board.setPointerCapture = vi.fn();
    board.hasPointerCapture = () => false;
    await act(async () => {
      pointer(pin, "pointerdown", 1, 300, 300);
      pointer(pin, "pointermove", 1, 420, 340);
      await vi.advanceTimersByTimeAsync(16);
      pointer(pin, "pointerup", 1, 420, 340);
      pin.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    });
    expect(open).not.toHaveBeenCalled();
    expect(JSON.parse(board.dataset.camera!).cx).toBeLessThan(500);
    await act(async () => {
      pointer(pin, "pointerdown", 2, 420, 340);
      pointer(pin, "pointerup", 2, 420, 340);
      pin.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    });
    expect(open).toHaveBeenCalledOnce();
  });
});

describe("file preview, explicit import, candidate confirmation and remount", () => {
  it("runs the real service/EXIF path from the file input and restores confirmed photos after reopening", async () => {
    const factory = new IDBFactory(),
      now = Date.UTC(2026, 10, 18);
    const open = async () => {
      const db = await openDatabase(factory, now);
      const service = new TravelFrogService({
        gateway: new IdbUnitOfWork(db),
        clock: { now: () => now, localOffsetMinutes: () => 0 },
        ids: new CryptoIdGenerator(),
        exif: new BrowserExifReader(),
        // jsdom has no image decoder. Supply a real fixture Blob for this DOM/service test;
        // native decoding and visible pixels are checked separately in Chromium.
        thumbnails: {create:async file=>new Blob([new Uint8Array(await file.arrayBuffer())],{type:'image/jpeg'})},
        fingerprints: new BrowserFingerprintReader(),
        cityResolver: new GazetteerCityResolver(),
        logger: new RingBufferLogger(),
      });
      await service.load();
      return { service, db };
    };
    const first = await open();
    function Harness({ service }: { service: TravelFrogService }) {
      const snapshot = useSyncExternalStore(
        service.subscribe.bind(service),
        () => service.getSnapshot(),
      );
      const [tab, setTab] = useState<DrawerTab>("import");
      return (
        <>
          <output>
            {snapshot.trips.length}趟/{snapshot.photos.length}张
          </output>
          <Drawer
            open
            tab={tab}
            onTab={setTab}
            onClose={() => {}}
            candidates={snapshot.candidates}
            batches={snapshot.batches}
            issues={snapshot.issues}
            suggestions={[]}
            photosById={new Map(snapshot.photos.map((p) => [p.id, p]))}
            onImportFiles={(files, p) => service.importFiles(files, p)}
            onConfirmCandidate={async (id) => {
              await service.confirmCandidate(id);
            }}
            onIgnoreCandidate={async () => {}}
            onMergeCandidates={async () => {}}
            onSplitCandidate={async () => {}}
            onApplySuggestions={async () => {}}
          />
        </>
      );
    }
    const host = mountHost();
    await act(async () => root!.render(<Harness service={first.service} />));
    const files = [1, 2, 3].map(
      (n) =>
        new NodeFile(
          [readFileSync(`src/application/fixtures/paris-${n}.jpg`)],
          `paris-${n}.jpg`,
          { type: "image/jpeg" },
        ),
    );
    const input = host.querySelector("#wall-file-input") as HTMLInputElement;
    Object.defineProperty(input, "files", { configurable: true, value: files });
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(first.service.getSnapshot().photos).toHaveLength(0);
    expect(host.textContent).toContain("paris-1.jpg");
    const importButton = [...host.querySelectorAll("button")].find(
      (b) =>
        b.textContent?.includes("导入3个文件") ||
        /导入\s*3\s*个文件/.test(b.textContent ?? ""),
    );
    expect(importButton).toBeTruthy();
    await act(async () => {
      importButton!.click();
      await vi.waitFor(() =>
        expect(first.service.getSnapshot().photos).toHaveLength(3),
      );
    });
    await act(async () => {
      const tab = [...host.querySelectorAll("button[role=tab]")].find((b) =>
        b.textContent?.startsWith("候选"),
      );
      expect(tab).toBeTruthy();
      (tab as HTMLButtonElement).click();
    });
    await act(async () => {
      const confirm = [...host.querySelectorAll("button")].find(
        (b) => b.textContent?.trim() === "确认并在地图查看",
      );
      expect(confirm).toBeTruthy();
      confirm!.click();
      await vi.waitFor(() =>
        expect(first.service.getSnapshot().trips).toHaveLength(1),
      );
    });
    const oldPhotos = structuredClone(first.service.getSnapshot().photos),
      oldJourney = structuredClone(first.service.getSnapshot().frogTravel);
    await act(() => root!.unmount());
    root = undefined;
    first.db.close();
    const reopened = await open();
    mountHost();
    await act(async () => root!.render(<Harness service={reopened.service} />));
    expect(document.body.textContent).toContain("1趟/3张");
    expect(reopened.service.getSnapshot().photos).toEqual(oldPhotos);
    expect(reopened.service.getSnapshot().frogTravel).toEqual(oldJourney);
    reopened.db.close();
    // This is jsdom+fake-indexeddb, not a browser bitmap/GPU/device test.
  });
});
