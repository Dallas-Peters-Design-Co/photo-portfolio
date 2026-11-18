import { describe, expect, it } from "vitest";
import { EMPTY_KIT } from "./brandKit.js";
import { componentSource } from "./componentSource.js";
import { createConceptElement } from "./conceptDefaults.js";
import { cleanElement } from "./reviewConcept.js";

const kit = {
  ...EMPTY_KIT,
  logos: [
    {
      clearSpace: 0.5,
      label: "Mark",
      minWidth: 24,
      rules: "",
      url: "https://x.test/mark.png",
    },
  ],
};

describe("a logo element", () => {
  it("starts as the kit's first logo, 32 px high", () => {
    const logo = createConceptElement("logo", kit);
    expect(logo.logoUrl).toBe("https://x.test/mark.png");
    expect(logo.logoHeight).toBe(32);
  });

  it("keeps a picture on https only, and bounds its height", () => {
    expect(
      cleanElement({ kind: "logo", logoHeight: 999, logoUrl: "http://x/a.png" })
    ).toMatchObject({ logoHeight: 160 });
    expect(
      cleanElement({ kind: "logo", logoUrl: "http://x/a.png" }).logoUrl
    ).toBeUndefined();
  });

  it("copies as an img at its height", () => {
    const { css, tsx } = componentSource(
      createConceptElement("logo", kit),
      "Logo"
    );
    expect(tsx).toContain('src="https://x.test/mark.png"');
    expect(css).toContain("height: 32px");
  });
});

describe("a navbar element", () => {
  it("starts with the logo at the start, links in the middle, actions at the end", () => {
    const bar = createConceptElement("navbar", kit);
    expect(bar.slots?.header?.elements.map((e) => e.kind)).toEqual(["logo"]);
    expect(bar.slots?.body?.elements.map((e) => e.text)).toEqual([
      "Product",
      "Pricing",
      "About",
    ]);
    expect(bar.slots?.footer?.elements.map((e) => e.kind)).toEqual([
      "link",
      "button",
    ]);
  });

  it("keeps its slots through cleaning, and copies as a nav", () => {
    const bar = cleanElement(createConceptElement("navbar", kit));
    expect(bar.slots?.body?.elements).toHaveLength(3);
    expect(componentSource(bar, "Navbar").tsx).toContain("<nav");
  });
});
