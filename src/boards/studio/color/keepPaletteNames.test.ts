import { expect, test } from "vitest";
import { keepPaletteNames } from "./keepPaletteNames";

const PRETEXT = [
  { name: "Primary", role: "button", value: "#2c5bc5" },
  { name: "Accent", role: "decorative", value: "#401348" },
  { name: "Ink", role: "ink", value: "#000000" },
];

test("another brand's colours change the colours, not the kit's names", () => {
  const next = keepPaletteNames(
    PRETEXT,
    ["#009387", "#3D5A45"],
    [
      { name: "Teal", role: "button" },
      { name: "Ink muted", role: "muted-text" },
    ]
  );
  expect(next).toEqual([
    { name: "Primary", role: "button", value: "#009387" },
    { name: "Accent", role: "decorative", value: "#3d5a45" },
    // Past the new colours, the kit's own stay.
    { name: "Ink", role: "ink", value: "#000000" },
  ]);
});

test("a place the kit had nothing in takes the loaded name", () => {
  const next = keepPaletteNames(
    PRETEXT.slice(0, 1),
    ["#111111", "#222222"],
    [null, { name: "Panel", role: "surface" }]
  );
  expect(next[1]).toEqual({ name: "Panel", role: "surface", value: "#222222" });
});

test("keeps a named variable even when another role uses the same colour", () => {
  const next = keepPaletteNames(PRETEXT, ["#000000"]);
  expect(next.map((e) => e.name)).toEqual(["Primary", "Accent", "Ink"]);
  expect(next[2]).toEqual(PRETEXT[2]);
});
