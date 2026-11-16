import { afterEach, expect, it, vi } from "vitest";
import { loadImage } from "./exportPng";

const LOGO =
  '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 458 174"><rect width="458" height="174" fill="#f00"/></svg>';

afterEach(() => {
  vi.unstubAllGlobals();
});

it("draws a percent-sized SVG at its viewBox's shape, not 300×150", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(new Response(LOGO)))
  );
  const img = await loadImage("https://example.test/logo.svg");
  expect(img.naturalWidth / img.naturalHeight).toBeCloseTo(458 / 174, 2);
  expect(img.naturalWidth).toBeGreaterThan(1000);
});

it("falls back to the plain image when the markup can't be read", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.reject(new Error("offline")))
  );
  const url = `data:image/svg+xml,${encodeURIComponent(LOGO.replace('width="100%" height="100%"', 'width="40" height="20"'))}#.svg`;
  const img = await loadImage(url);
  expect(img.naturalWidth).toBe(40);
});
