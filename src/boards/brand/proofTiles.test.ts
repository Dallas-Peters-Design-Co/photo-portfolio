import { describe, expect, it } from "vitest";
import { EMPTY_KIT } from "../../../config/brandKit.js";
import { PLACEMENT_SIZES, proofTilesFor } from "./proofTiles";

/**
 * What a proof board is made of.
 *
 * The plan is the part worth testing: a sheet that silently drops the
 * greyscale tile, or refuses to render until a kit is finished, is wrong in a
 * way nobody notices — it just looks like a shorter sheet.
 */

const kit = (palette: { name: string; role: string; value: string }[]) => ({
  ...EMPTY_KIT,
  palette,
});

describe("proofTilesFor", () => {
  it("gives a full sheet for a kit with nothing filled in yet", () => {
    // The commonest moment to want a proof sheet is before the kit is
    // finished. A sheet that waits for every field would be useless then.
    const tiles = proofTilesFor(EMPTY_KIT);
    expect(tiles.length).toBeGreaterThanOrEqual(7);
    expect(tiles.map((tile) => tile.kind)).toContain("scale");
    expect(tiles.map((tile) => tile.kind)).toContain("greyscale");
  });

  it("leads with the two tests a mark must not fail", () => {
    // Size and colourlessness come before anything about this brand in
    // particular, because they are the ones that are not a matter of taste.
    const [first, second] = proofTilesFor(EMPTY_KIT);
    expect(first.kind).toBe("scale");
    expect(second.kind).toBe("greyscale");
  });

  it("always tests black and white", () => {
    const grounds = proofTilesFor(EMPTY_KIT)
      .filter((tile) => tile.kind === "ground")
      .map((tile) => tile.background);
    expect(grounds).toEqual(["#ffffff", "#000000"]);
  });

  it("asks the brand's own ground once, not once per colour", () => {
    /*
     * A square per palette entry filled most of the sheet with near-identical
     * pictures. A sheet a client scrolls past is worth less than a shorter one
     * they read, and black and white already ask the contrast question — this
     * asks it again only on the colour the brand leads with.
     */
    const tiles = proofTilesFor(
      kit([
        { name: "Ink", role: "text", value: "#101a2b" },
        { name: "Cobalt", role: "accent", value: "#2e84f5" },
      ])
    );
    const contrast = tiles.filter((tile) => tile.kind === "contrast");
    expect(contrast).toHaveLength(1);
    expect(contrast[0].background).toBe("#101a2b");
    expect(contrast[0].label).toBe("Ink");
  });

  it("falls back to the hex when a colour was never named", () => {
    const tiles = proofTilesFor(
      kit([{ name: "", role: "", value: "#abcdef" }])
    );
    const [contrast] = tiles.filter((tile) => tile.kind === "contrast");
    expect(contrast.label).toBe("#abcdef");
  });

  it("gives the squint tile an actual blur", () => {
    // A squint test that does not blur is a second copy of the mark.
    const [squint] = proofTilesFor(EMPTY_KIT).filter(
      (tile) => tile.kind === "squint"
    );
    expect(squint.blur).toBeGreaterThan(0);
  });

  it("every tile says what it is asking", () => {
    // The caption is what a finding quotes. A tile with no caption is a
    // picture with no claim, which is decoration.
    for (const tile of proofTilesFor(
      kit([{ name: "Ink", role: "", value: "#101a2b" }])
    )) {
      expect(tile.caption.length, tile.label).toBeGreaterThan(20);
      expect(tile.label.length, tile.kind).toBeGreaterThan(0);
    }
  });
});

describe("PLACEMENT_SIZES", () => {
  it("tests the sizes things actually ship at", () => {
    // Real placements rather than a neat progression: a ramp of powers of two
    // looks tidier and tests nothing anybody ships.
    const px = PLACEMENT_SIZES.map((size) => size.px);
    expect(px).toContain(16);
    expect(px).toContain(180);
  });

  it("runs smallest first, because that is where marks fail", () => {
    const px = PLACEMENT_SIZES.map((size) => size.px);
    expect(px).toEqual([...px].sort((a, b) => a - b));
  });
});

describe("the drawn surfaces", () => {
  it("puts one tile on the sheet for each", async () => {
    const { TEMPLATES } = await import("./templates");
    const surfaces = proofTilesFor(EMPTY_KIT).filter(
      (tile) => tile.kind === "surface"
    );
    expect(surfaces).toHaveLength(TEMPLATES.length);
    expect(surfaces.map((tile) => tile.label)).toEqual(
      TEMPLATES.map((template) => template.label)
    );
  });

  it("labels them the way the renderer looks them up", async () => {
    // drawMockup finds its config by label. A tile whose label drifts from
    // its entry draws an empty square, which reads as a broken renderer.
    const { TEMPLATES } = await import("./templates");
    for (const template of TEMPLATES) {
      expect(
        proofTilesFor(EMPTY_KIT).some((tile) => tile.label === template.label),
        template.label
      ).toBe(true);
    }
  });

  it("keeps the mark inside the photograph it is printed on", async () => {
    // An area running past the edge draws the mark over the scene behind the
    // surface, which reads as a rendering bug rather than as a mockup.
    const { TEMPLATES } = await import("./templates");
    for (const { area, label } of TEMPLATES) {
      expect(area.x + area.w, label).toBeLessThanOrEqual(1);
      expect(area.y + area.h, label).toBeLessThanOrEqual(1);
    }
  });

  it("gives every surface tile a template to find", async () => {
    // drawTemplate looks its photograph up by id. A tile without one draws
    // the bare photo and no mark, which looks like a failed upload.
    const { TEMPLATES } = await import("./templates");
    const ids = new Set(TEMPLATES.map((template) => template.id));
    for (const tile of proofTilesFor(EMPTY_KIT)) {
      if (tile.kind === "surface") {
        expect(tile.templateId && ids.has(tile.templateId), tile.label).toBe(
          true
        );
      }
    }
  });
});
