import { describe, expect, it } from "vitest";
import { EMPTY_KIT } from "../../config/brandKit.js";
import type { BrandKit } from "../services/brandKitService";
import { createNeutralEdit } from "./adjustments";
import { LOOKS } from "./presets";
import {
  brandLooks,
  findLook,
  initialsOf,
  type SavedLook,
  savedLookEdit,
  savedToLook,
} from "./savedLooks";

const saved: SavedLook = {
  edit: {
    contrast: 0.3,
    curveAmount: 0.5,
    fade: "bad" as unknown as number,
    lutId: "kodak",
  },
  id: "abc",
  name: "Bird Creek Warm",
  updatedAt: "2026-11-01T00:00:00.000Z",
};

const kit = (
  id: string,
  name: string,
  look: { id: string; strength: number } | null
) => ({ id, name, resolvedDoc: { ...EMPTY_KIT, look } }) as unknown as BrandKit;

describe("saved looks", () => {
  it("merges a stored edit onto neutral and drops wrong types", () => {
    const edit = savedLookEdit(saved.edit);
    expect(edit.contrast).toBe(0.3);
    expect(edit.curveAmount).toBe(0.5);
    expect(edit.fade).toBe(0);
    expect(edit.lutId).toBe("kodak");
    expect(edit.hsl).toEqual(createNeutralEdit().hsl);
  });

  it("becomes a strip look with initials and a namespaced id", () => {
    expect(savedToLook(saved, 0)).toMatchObject({
      code: "BC",
      family: "saved",
      id: "saved:abc",
      name: "Bird Creek Warm",
    });
    expect(initialsOf("Moody")).toBe("MO");
  });

  it("finds built-in and saved looks by id", () => {
    const first = LOOKS[0];
    expect(findLook(first?.id ?? "", [])).toBe(first);
    expect(findLook("saved:abc", [saved])?.name).toBe("Bird Creek Warm");
    expect(findLook("saved:missing", [saved])).toBeNull();
  });

  it("gives each brand with a look its own strip entry", () => {
    const builtIn = LOOKS[0]?.id ?? "";
    const out = brandLooks(
      [
        kit("k1", "Bird Creek", { id: "saved:abc", strength: 0.5 }),
        kit("k2", "TSRP", null),
        kit("k3", "Viaskai", { id: builtIn, strength: 1 }),
      ],
      [saved]
    );
    expect(out.map((l) => l.id)).toEqual(["brand:k1", "brand:k3"]);
    expect(out[0]?.name).toBe("Bird Creek · Bird Creek Warm");
    // Applied at the kit's strength.
    expect(out[0]?.edit.contrast).toBeCloseTo(0.15);
  });
});
