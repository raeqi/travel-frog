import { describe, expect, it } from "vitest";
import type { ImportSummary } from "../../application/import-photos";
import {
  fileKey,
  hasFileDrag,
  mergeSelection,
  nextStepForImport,
  removeSelection,
  summarizeSelection,
} from "./import-selection";

function file(name: string, size = 4, lastModified = 100, type = "image/jpeg"): File {
  return new File(["x".repeat(size)], name, { type, lastModified });
}

function summary(patch: Partial<ImportSummary> = {}): ImportSummary {
  return {
    batchId: "batch_1",
    imported: 3,
    duplicates: 0,
    failed: 0,
    candidateCount: 1,
    issues: [],
    ...patch,
  };
}

describe("import selection", () => {
  it("appends new files and skips the same file picked twice", () => {
    const first = file("a.jpg", 5, 10);
    const again = file("a.jpg", 5, 10);
    const second = file("b.jpg", 7, 20);
    const merged = mergeSelection([first], [again, second]);
    expect(merged).toEqual([first, second]);
    expect(fileKey(again)).toBe(fileKey(first));
  });

  it("keeps same-named files when size or modification time differs", () => {
    const a = file("IMG_0001.jpg", 5, 10);
    const b = file("IMG_0001.jpg", 6, 10);
    const c = file("IMG_0001.jpg", 5, 11);
    expect(mergeSelection([a], [b, c])).toEqual([a, b, c]);
  });

  it("removes one file by key without touching the others", () => {
    const a = file("a.jpg");
    const b = file("b.jpg");
    expect(removeSelection([a, b], fileKey(a))).toEqual([b]);
  });

  it("summarizes total size, HEIC and unsupported formats", () => {
    const result = summarizeSelection([
      file("a.jpg", 5),
      file("b.HEIC", 7, 1, "image/heic"),
      file("notes.txt", 3, 1, "text/plain"),
    ]);
    expect(result).toEqual({
      count: 3,
      totalBytes: 15,
      heic: 1,
      unsupported: 1,
    });
  });

  it("only treats a drag carrying files as a photo drop", () => {
    expect(hasFileDrag({ types: ["Files"] } as unknown as DataTransfer)).toBe(true);
    expect(
      hasFileDrag({ types: ["text/plain"] } as unknown as DataTransfer),
    ).toBe(false);
    expect(hasFileDrag(null)).toBe(false);
  });
});

describe("next step after import", () => {
  it("sends missing time or failures to repair first", () => {
    expect(nextStepForImport(summary({ missingTime: 1 }))).toBe("repair");
    expect(nextStepForImport(summary({ failed: 1 }))).toBe("repair");
    expect(nextStepForImport(summary({ needsRepair: 1 }))).toBe("repair");
  });

  it("sends unlocated photos to the location workbench", () => {
    expect(
      nextStepForImport(summary({ withoutLocation: 2, withLocation: 1 })),
    ).toBe("location");
  });

  it("uses candidates when every imported photo already has a location", () => {
    expect(
      nextStepForImport(
        summary({ withLocation: 3, withoutLocation: 0, candidateCount: 1 }),
      ),
    ).toBe("candidates");
  });

  it("is done when there is nothing left to confirm", () => {
    expect(
      nextStepForImport(
        summary({ withLocation: 0, withoutLocation: 0, candidateCount: 0, duplicates: 3 }),
      ),
    ).toBe("done");
  });

  it("uses this import's summary, not archive-wide repair photos", () => {
    // The Drawer used to compute repair from every archived photo, so a clean
    // import was sent to repair whenever an unrelated photo was pending.
    expect(
      nextStepForImport(
        summary({ withoutLocation: 0, needsRepair: 0, candidateCount: 2 }),
      ),
    ).toBe("candidates");
  });
});
