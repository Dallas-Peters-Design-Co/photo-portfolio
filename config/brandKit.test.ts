import { describe, expect, it } from "vitest";
import {
  EMPTY_KIT,
  inheritedParts,
  MAX_PALETTE,
  paletteFromCss,
  resolveKitDoc,
  sanitizeKitDoc,
} from "./brandKit";

const kit = (over: Partial<typeof EMPTY_KIT> = {}) => ({
  ...EMPTY_KIT,
  ...over,
});

describe("sanitizeKitDoc — clamps rather than rejects", () => {
  it("keeps the colours it can and drops only what has no meaning", () => {
    const doc = sanitizeKitDoc({
      palette: [
        { name: "Ink", role: "surface", value: "#101A2B" },
        { name: "Broken", role: "", value: "not-a-colour" },
        { name: "Signal", role: "accent", value: "#4ade80" },
      ],
    });
    // The bad one goes; the other two survive rather than the save failing.
    expect(doc.palette.map((entry) => entry.value)).toEqual([
      "#101a2b",
      "#4ade80",
    ]);
  });

  it("caps the palette instead of refusing an over-long one", () => {
    const doc = sanitizeKitDoc({
      palette: Array.from({ length: MAX_PALETTE + 6 }, (_, i) => ({
        name: `c${i}`,
        role: "",
        // Distinct, valid, and more than the limit allows.
        value: `#0000${i.toString(16).padStart(2, "0")}`,
      })),
    });
    expect(doc.palette).toHaveLength(MAX_PALETTE);
  });

  it("treats a look with no strength as fully applied", () => {
    expect(sanitizeKitDoc({ look: { id: "a3" } }).look).toEqual({
      id: "a3",
      strength: 1,
    });
  });

  it("holds strength inside 0 and 1", () => {
    expect(
      sanitizeKitDoc({ look: { id: "a3", strength: 4 } }).look?.strength
    ).toBe(1);
    expect(
      sanitizeKitDoc({ look: { id: "a3", strength: -2 } }).look?.strength
    ).toBe(0);
  });

  it("has no look when the id is missing or blank", () => {
    expect(sanitizeKitDoc({ look: { strength: 0.5 } }).look).toBeNull();
    expect(sanitizeKitDoc({ look: { id: "   " } }).look).toBeNull();
  });

  it("drops a logo with no url, since the url is the logo", () => {
    const doc = sanitizeKitDoc({
      logos: [
        { label: "Real", url: "https://example.com/a.png" },
        { label: "Nothing", url: "" },
      ],
    });
    expect(doc.logos).toHaveLength(1);
  });
});

describe("typefaces entered by name", () => {
  it("load from Google Fonts", () => {
    const doc = sanitizeKitDoc({
      typefaces: [
        { name: "DM Sans", ref: null, role: "headline", weights: [] },
        { name: "Geist Mono", role: "body" },
      ],
    });
    expect(doc.typefaces.map((f) => f.ref)).toEqual([
      "g:DM Sans",
      "g:Geist Mono",
    ]);
  });
});

describe("resolveKitDoc — a sub-brand against its parent", () => {
  const parent = kit({
    look: { id: "b2", strength: 0.6 },
    palette: [{ name: "Ink", role: "surface", value: "#101a2b" }],
    typefaces: [{ name: "Geist", role: "ui", weights: [400] }],
    voice: "Plain and unfussy.",
  });

  it("returns the child untouched when there is no parent", () => {
    const child = kit({ voice: "Mine." });
    expect(resolveKitDoc(child, null)).toBe(child);
  });

  it("inherits every part the child leaves empty", () => {
    const resolved = resolveKitDoc(kit(), parent);
    expect(resolved.palette).toEqual(parent.palette);
    expect(resolved.voice).toBe("Plain and unfussy.");
    expect(resolved.look).toEqual({ id: "b2", strength: 0.6 });
  });

  it("replaces a part wholesale rather than merging it", () => {
    const child = kit({
      palette: [{ name: "Own", role: "accent", value: "#ff0000" }],
    });
    const resolved = resolveKitDoc(child, parent);
    // One colour, the child's — not two from both brands.
    expect(resolved.palette).toHaveLength(1);
    expect(resolved.palette[0]?.value).toBe("#ff0000");
  });

  it("keeps the parent's other parts when the child overrides one", () => {
    const child = kit({
      palette: [{ name: "Own", role: "accent", value: "#ff0000" }],
    });
    const resolved = resolveKitDoc(child, parent);
    expect(resolved.typefaces).toEqual(parent.typefaces);
    expect(resolved.voice).toBe("Plain and unfussy.");
  });

  it("treats a blank voice as not stated, so clearing it inherits again", () => {
    expect(resolveKitDoc(kit({ voice: "   " }), parent).voice).toBe(
      "Plain and unfussy."
    );
  });

  it("says which parts were inherited", () => {
    const child = kit({
      palette: [{ name: "Own", role: "accent", value: "#ff0000" }],
    });
    expect(inheritedParts(child, parent).sort()).toEqual([
      "look",
      "typefaces",
      "voice",
    ]);
  });

  it("reports nothing inherited when there is no parent", () => {
    expect(inheritedParts(kit(), null)).toEqual([]);
  });
});

describe("paletteFromCss — colours out of a pasted stylesheet", () => {
  it("reads a custom property's name as the colour's name", () => {
    const found = paletteFromCss(":root { --brand-ink: #101a2b; }");
    expect(found).toEqual([{ name: "brand-ink", role: "", value: "#101a2b" }]);
  });

  it("expands three- and four-digit hexes", () => {
    expect(paletteFromCss("--a: #abc;").map((e) => e.value)).toEqual([
      "#aabbcc",
    ]);
  });

  it("drops the alpha off an eight-digit hex rather than the colour", () => {
    expect(paletteFromCss("--a: #101a2b80;").map((e) => e.value)).toEqual([
      "#101a2b",
    ]);
  });

  it("takes bare hexes too, unnamed", () => {
    const found = paletteFromCss("a { color: #4ade80; }");
    expect(found).toEqual([{ name: "", role: "", value: "#4ade80" }]);
  });

  it("collapses duplicates, keeping the first name seen", () => {
    const found = paletteFromCss(
      "--brand-ink: #101a2b; --alias: #101a2b; a { color: #101A2B; }"
    );
    expect(found).toHaveLength(1);
    expect(found[0]?.name).toBe("brand-ink");
  });

  it("never returns more than a palette can hold", () => {
    const css = Array.from(
      { length: MAX_PALETTE + 10 },
      (_, i) => `--c${i}: #0000${i.toString(16).padStart(2, "0")};`
    ).join(" ");
    expect(paletteFromCss(css)).toHaveLength(MAX_PALETTE);
  });

  it("finds nothing in a snippet with no colours", () => {
    expect(paletteFromCss("a { margin: 0 }")).toEqual([]);
  });
});

describe("library and references", () => {
  const LIB = "3f2a1b0c-1d2e-4f50-8a9b-0c1d2e3f4a5b";

  it("keeps a linked collection id and drops anything that isn't one", () => {
    expect(
      sanitizeKitDoc({ libraryCollectionId: LIB }).libraryCollectionId
    ).toBe(LIB);
    expect(
      sanitizeKitDoc({ libraryCollectionId: "not-a-uuid" }).libraryCollectionId
    ).toBeNull();
    expect(sanitizeKitDoc({}).libraryCollectionId).toBeNull();
  });

  it("clamps references, keeps good dates, and drops empty ones", () => {
    const refs = sanitizeKitDoc({
      references: [
        {
          body: "Use the teal for CTAs.",
          date: "2026-10-31",
          id: "a",
          source: "Obsidian: Bird Creek",
          title: "CTA colour",
        },
        { body: "", title: "" },
        { body: "x".repeat(5000), date: "Oct 31", title: "Long" },
      ],
    }).references;
    expect(refs).toHaveLength(2);
    expect(refs[0]).toMatchObject({
      date: "2026-10-31",
      id: "a",
      title: "CTA colour",
    });
    expect(refs[1]?.body).toHaveLength(4000);
    expect(refs[1]?.date).toBe("");
    expect(refs[1]?.id).toBe("ref-3");
  });

  it("inherits the library and references from the parent when unstated", () => {
    const parent = sanitizeKitDoc({
      libraryCollectionId: LIB,
      references: [{ body: "Parent rule", title: "Rule" }],
    });
    const child = sanitizeKitDoc({});
    const resolved = resolveKitDoc(child, parent);
    expect(resolved.libraryCollectionId).toBe(LIB);
    expect(resolved.references[0]?.title).toBe("Rule");
    expect(inheritedParts(child, parent)).toEqual(
      expect.arrayContaining(["library", "references"])
    );
  });
});
