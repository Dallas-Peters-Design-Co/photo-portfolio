import { describe, expect, it } from "vitest";
import { crc32, zip } from "./zip";

describe("zip", () => {
  it("computes the standard CRC-32", () => {
    expect(crc32(new TextEncoder().encode("hello"))).toBe(0x36_10_a6_86);
  });

  it("writes stored entries and an end record that counts them", async () => {
    const enc = new TextEncoder();
    const blob = zip([
      { bytes: enc.encode("<p>hi</p>"), name: "index.html" },
      { bytes: enc.encode("x"), name: "images/a.png" },
    ]);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const view = new DataView(bytes.buffer);
    const end = bytes.length - 22;
    expect(view.getUint32(end, true)).toBe(0x06_05_4b_50);
    expect(view.getUint16(end + 10, true)).toBe(2);
    const directory = view.getUint32(end + 16, true);
    expect(view.getUint32(directory, true)).toBe(0x02_01_4b_50);
  });
});
