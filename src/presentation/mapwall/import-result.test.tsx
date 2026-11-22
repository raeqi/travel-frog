// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { ImportSummary } from "../../application/import-photos";
import type { Photo } from "../../domain/photo/photo";
import { Drawer, type DrawerTab } from "./Drawer";

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

function summary(patch: Partial<ImportSummary>): ImportSummary {
  return {
    batchId: "batch_1",
    imported: 1,
    duplicates: 0,
    failed: 0,
    candidateCount: 1,
    ready: 1,
    needsRepair: 0,
    missingTime: 0,
    withLocation: 1,
    withoutLocation: 0,
    repaired: 0,
    issues: [],
    ...patch,
  };
}

function repairPhoto(): Photo {
  return {
    id: "broken",
    fileName: "broken.jpg",
    thumbRef: null,
    capturedAtSource: "missing",
    geo: null,
    ignored: false,
    tripId: null,
    importBatchId: "old_batch",
    capturedAt: Date.UTC(2025, 0, 1),
    captureOffsetMinutes: 0,
  } as unknown as Photo;
}

async function runDrawer(
  importSummary: ImportSummary,
  onTab: (tab: DrawerTab) => void,
  onOpenLocationInbox: (candidateId: string | null) => void,
) {
  const host = mount();
  const file = new File(["x"], "clean.jpg", { type: "image/jpeg" });
  function Harness() {
    const [selection, setSelection] = [
      [file] as readonly File[],
      (_files: readonly File[]) => {},
    ] as const;
    return (
      <Drawer
        open
        tab="import"
        onTab={onTab}
        onClose={() => {}}
        candidates={[]}
        batches={[]}
        issues={[]}
        suggestions={[]}
        photosById={new Map([[repairPhoto().id, repairPhoto()]])}
        selection={selection}
        onSelectionChange={setSelection}
        onImportFiles={async () => importSummary}
        onConfirmCandidate={async () => {}}
        onIgnoreCandidate={async () => {}}
        onMergeCandidates={async () => {}}
        onSplitCandidate={async () => {}}
        onApplySuggestions={async () => {}}
        onOpenLocationInbox={onOpenLocationInbox}
      />
    );
  }
  await act(async () => root!.render(<Harness />));
  const button = [...host.querySelectorAll(".import-selection-actions button")].find(
    (item) => item.textContent?.includes("导入 1 个文件"),
  );
  await act(async () =>
    button!.dispatchEvent(new MouseEvent("click", { bubbles: true })),
  );
  return host;
}

function cta(host: HTMLElement): HTMLButtonElement {
  const button = [...host.querySelectorAll<HTMLButtonElement>(".import-result-actions .btn.primary")][0];
  if (!button) throw new Error("result CTA not found");
  return button;
}

describe("import result next step", () => {
  it("does not send a clean import to repair just because another archived photo is broken", async () => {
    const onTab = vi.fn();
    const host = await runDrawer(
      summary({ candidateCount: 1, withoutLocation: 0, needsRepair: 0 }),
      onTab,
      vi.fn(),
    );
    expect(host.querySelector(".import-result")?.textContent).toContain(
      "确认候选旅行",
    );
    await act(async () =>
      cta(host).dispatchEvent(new MouseEvent("click", { bubbles: true })),
    );
    expect(onTab).toHaveBeenCalledWith("candidates");
    expect(onTab).not.toHaveBeenCalledWith("progress");
  });

  it("routes unlocated photos to the location workbench", async () => {
    const onOpenLocationInbox = vi.fn();
    const host = await runDrawer(
      summary({ withLocation: 0, withoutLocation: 2, candidateCount: 0 }),
      vi.fn(),
      onOpenLocationInbox,
    );
    expect(cta(host).textContent).toContain("标记位置");
    await act(async () =>
      cta(host).dispatchEvent(new MouseEvent("click", { bubbles: true })),
    );
    expect(onOpenLocationInbox).toHaveBeenCalledWith(null);
  });
});
