import { expect, test } from "vitest";
import { EMPTY_KIT } from "./brandKit";
import type { ConceptStyle } from "./conceptStyle";
import { carryStyles, withLinkedComponents } from "./kitComponentLink";

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
