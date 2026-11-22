import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BrowserExifReader } from "./exif-reader.browser";

function fixture(name: string): File {
  return new File(
    [
      new Uint8Array(
        readFileSync(new URL(`../../application/fixtures/${name}`, import.meta.url)),
      ),
    ],
    name,
    { type: "image/heic" },
  );
}

describe("HEIC metadata fallback", () => {
  it("reads GPS and capture time the built-in container parser cannot reach", async () => {
    const data = await new BrowserExifReader().read(fixture("heic-with-gps.heic"));
    expect(data.geo?.lat).toBeCloseTo(48.85, 1);
    expect(data.geo?.lng).toBeCloseTo(2.35, 1);
    expect(data.capturedAtSource).toBe("exif-original");
    expect(data.capturedAt).not.toBeNull();
    expect(new Date(data.capturedAt!).toISOString()).toBe(
      "2020-05-02T11:00:00.000Z",
    );
  });

  it("does not invent metadata when the HEIC has none", async () => {
    const data = await new BrowserExifReader().read(
      fixture("synthetic-no-time.heic"),
    );
    expect(data.geo).toBeNull();
    expect(data.capturedAt).toBeNull();
    expect(data.capturedAtSource).toBeNull();
  });
});
