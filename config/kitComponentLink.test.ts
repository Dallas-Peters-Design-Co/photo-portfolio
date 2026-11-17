import { expect, test } from "vitest";
import { EMPTY_KIT, sanitizeKitDoc } from "./brandKit";
import type { ConceptStyle } from "./conceptStyle";
import {
  carryStyles,
  withLinkedComponents,
  withLinkedPalette,
} from "./kitComponentLink";

const ROLEMODEL = {
  ...EMPTY_KIT,
  palette: [
    { name: "Navy", role: "button", value: "#041045" },
    { name: "White", role: "background", value: "#ffffff" },
  ],
  typefaces: [{ name: "Inter", ref: "g:Inter", role: "body", weights: [400] }],
};

const PRETEXT = {
  ...EMPTY_KIT,
  palette: [
    { name: "Paper", role: "background", value: "#f6f0e0" },
    { name: "Teal", role: "button", value: "#009387" },
  ],
  typefaces: [{ name: "Figtree", ref: "g:Figtree", role: "body", weights: [] }],
};

const BUTTON = {
  id: "s1",
  kind: "button",
  look: {
    background: "#041045",
    color: "#FFFFFF",
    fontFamily: "brand",
    fontRef: "g:Inter",
    hover: { background: "#04104580" },
  },
  name: "Primary",
} as unknown as ConceptStyle;

test("a linked style is drawn in this brand's colours and type, by role", () => {
  const [style] = carryStyles([BUTTON], ROLEMODEL, PRETEXT);
  expect(style?.id).toBe("s1");
  expect(style?.look).toMatchObject({
    background: "#009387",
    color: "#f6f0e0",
    fontRef: "g:Figtree",
    // Transparency stays with the colour it was on.
    hover: { background: "#00938780" },
  });
});

test("a kit with its own styles doesn't follow the link", () => {
  const own = { ...PRETEXT, componentStyles: [BUTTON], componentsFrom: "x" };
  const source = { ...ROLEMODEL, componentStyles: [BUTTON] };
  expect(withLinkedComponents(own, own, source).componentStyles).toEqual([
    BUTTON,
  ]);
  const following = { ...PRETEXT, componentsFrom: "x" };
  expect(
    withLinkedComponents(following, following, source).componentStyles[0]?.look
  ).toMatchObject({ background: "#009387" });
});

test("a kit with no colours follows the linked kit's palette; its own win", () => {
  const sourceId = "11111111-1111-4111-8111-111111111111";
  const source = {
    ...EMPTY_KIT,
    palette: [{ name: "Navy", role: "brand", value: "#0a1f44" }],
  };
  const following = sanitizeKitDoc({ ...EMPTY_KIT, paletteFrom: sourceId });
  expect(following.paletteFrom).toBe(sourceId);
  expect(withLinkedPalette(following, following, source).palette).toEqual(
    source.palette
  );
  const own = {
    ...following,
    palette: [{ name: "Red", role: "brand", value: "#ff0000" }],
  };
  expect(withLinkedPalette(own, own, source).palette).toEqual(own.palette);
  expect(withLinkedPalette(following, following, null).palette).toEqual([]);
});
