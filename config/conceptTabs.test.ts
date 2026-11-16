import { describe, expect, it } from "vitest";
import { cleanConceptStyles } from "./conceptStyle.js";
import { cleanTabLook } from "./conceptTabs.js";
import { cleanConcept } from "./reviewConcept.js";

describe("tab look", () => {
  it("keeps colours and clamps sizes", () => {
    expect(
      cleanTabLook({
        activeColor: "#111111",
        height: 500,
        inactiveColor: "nope",
        indicatorColor: "#ff0000",
        indicatorSize: 0,
        rowPaddingX: 90,
      })
    ).toEqual({
      activeColor: "#111111",
      height: 96,
      indicatorColor: "#ff0000",
      indicatorSize: 1,
      rowPaddingX: 48,
    });
    expect(cleanTabLook({})).toBeUndefined();
  });

  it("is kept on tabs only, and carried by a kit style", () => {
    const tabLook = { indicatorColor: "#ff0000", indicatorSize: 3 };
    const [tabs, button] = cleanConcept({
      elements: [
        { kind: "tabs", tabLook },
        { kind: "button", tabLook },
      ],
    }).elements;
    expect(tabs?.tabLook).toEqual(tabLook);
    expect(button?.tabLook).toBeUndefined();
    const [style] = cleanConceptStyles([
      { id: "t", kind: "tabs", look: { tabLook }, name: "Underline" },
    ]);
    expect(style?.look.tabLook).toEqual(tabLook);
  });
});
