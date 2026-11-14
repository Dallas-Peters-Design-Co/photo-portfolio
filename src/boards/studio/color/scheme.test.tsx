import "../../../index.css";
import "../Studio.css";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { hexToOklch } from "../../../lib/oklch";
import {
  buildScheme,
  hueOffsets,
  hueSpacing,
  SCHEME_DEFAULTS,
  type SchemeOptions,
  simulate,
} from "./scheme";

vi.mock("../../brand/ActiveBrand", () => ({
  useActiveBrand: () => null,
  useBrandSwatches: () => null,
}));

const HEX = /^#[0-9a-f]{6}$/;
const ANCHOR = "#2f7cf6";
const make = (over: Partial<SchemeOptions> = {}) =>
  buildScheme({ ...SCHEME_DEFAULTS, anchor: ANCHOR, ...over });
const lch = (hex: string) => hexToOklch(hex) ?? { c: 0, h: 0, l: 0 };
const hueGap = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
};

describe("buildScheme", () => {
  it("makes the count asked for, anchor first and untouched, for every model", () => {
    for (const model of [
      "balance",
      "adaptive",
      "companion",
      "composition",
    ] as const) {
      for (const count of [2, 4, 9]) {
        const out = make({ count, model });
        expect(out).toHaveLength(count);
        expect(out[0]).toBe(ANCHOR);
        expect(out.every((c) => HEX.test(c))).toBe(true);
      }
    }
  });

  it("spreads four hues a quarter turn apart at a full spread", () => {
    expect(hueOffsets(4, "spread", 360)).toEqual([0, 90, 180, 270]);
    const hues = make().map((c) => lch(c).h);
    for (const [i, h] of hues.entries()) {
      // Within a few degrees: bringing a colour into sRGB can nudge its hue.
      expect(hueGap(h, (hues[0] ?? 0) + 90 * i)).toBeLessThan(12);
    }
  });

  it("keeps nearby hues beside the anchor and sends opposite ones across", () => {
    const near = make({ hues: "nearby", spread: 180 }).map((c) => lch(c).h);
    for (const h of near) {
      expect(hueGap(h, near[0] ?? 0)).toBeLessThan(75);
    }
    const across = make({ count: 2, hues: "opposite" }).map((c) => lch(c).h);
    expect(hueGap(across[0] ?? 0, across[1] ?? 0)).toBeGreaterThan(150);
  });

  it("balances lightness, and matches chroma down to the quietest", () => {
    const even = make().map((c) => lch(c).l);
    expect(Math.max(...even) - Math.min(...even)).toBeLessThan(0.06);
    const matched = make({ matchChroma: true }).map((c) => lch(c).c);
    expect(Math.max(...matched) - Math.min(...matched)).toBeLessThan(0.02);
  });

  it("turns the last companions into tinted neutrals", () => {
    const out = make({ count: 5, neutrals: 2 });
    expect(lch(out[4] ?? "").c).toBeLessThan(0.03);
    expect(lch(out[3] ?? "").c).toBeLessThan(0.03);
    expect(lch(out[2] ?? "").c).toBeGreaterThan(0.05);
    expect(out[0]).toBe(ANCHOR);
  });

  it("runs a sequential ramp from light to dark through the anchor", () => {
    const out = make({ count: 7, model: "sequential" });
    const ls = out.map((c) => lch(c).l);
    for (let i = 1; i < ls.length; i += 1) {
      expect(ls[i]).toBeLessThan(ls[i - 1] ?? 1);
    }
    expect(out).toContain(ANCHOR);
  });

  it("meets two hues at a pale middle when diverging", () => {
    const out = make({ count: 7, model: "diverging" });
    const mid = lch(out[3] ?? "");
    expect(mid.l).toBeGreaterThan(0.9);
    expect(mid.c).toBeLessThan(0.03);
    expect(hueGap(lch(out[0] ?? "").h, lch(out[6] ?? "").h)).toBeGreaterThan(
      90
    );
  });

  it("takes a hue set by hand for one colour and leaves the rest", () => {
    const plain = make();
    const moved = make({ hueAt: [null, null, 40] });
    expect(hueGap(lch(moved[2] ?? "").h, 40)).toBeLessThan(8);
    expect(moved[1]).toBe(plain[1]);
    expect(moved[3]).toBe(plain[3]);
    expect(hueSpacing([0, 90, 180, 270])).toBe(90);
    expect(hueSpacing([350, 10, 180])).toBe(20);
  });

  it("keeps a locked colour where it is", () => {
    const out = make({ locked: [null, null, "#123456"], model: "companion" });
    expect(out[2]).toBe("#123456");
  });
});

describe("simulate", () => {
  it("leaves greys alone and pulls red and green together", () => {
    expect(simulate("#808080", "deuteranopia")).toBe("#808080");
    const red = lch(simulate("#d03030", "deuteranopia"));
    const green = lch(simulate("#30a030", "deuteranopia"));
    expect(hueGap(red.h, green.h)).toBeLessThan(30);
    expect(simulate("#d03030", "none")).toBe("#d03030");
  });
});

describe("SchemeTool", () => {
  it("rebuilds the palette as the settings change", async () => {
    await page.viewport(1200, 900);
    const { SchemeTool } = await import("./SchemeTool");
    const host = document.createElement("div");
    host.className = "studio";
    host.style.cssText = "position:static;width:800px;max-height:none";
    document.body.append(host);
    const root = createRoot(host);
    act(() => root.render(<SchemeTool onAdd={() => undefined} />));
    const swatches = () => host.querySelectorAll(".studio-palette__swatch");
    expect(swatches()).toHaveLength(4);
    const first = swatches()[1]?.textContent;
    act(() =>
      (
        [...host.querySelectorAll("[role=radio]")].find(
          (b) => b.textContent === "Sequential"
        ) as HTMLElement
      ).click()
    );
    expect(swatches()[1]?.textContent).not.toBe(first);
    // A ramp has no neutrals to offer.
    expect(host.textContent).not.toContain("Neutrals");
    // In a ramp the anchor sits where its lightness falls, and says so.
    const anchor = host.querySelector(".studio-scheme__anchor")?.parentElement;
    expect(anchor?.textContent).toContain("2F7CF6");
    act(() => root.unmount());
    host.remove();
  });
});

describe("dialling a palette in", () => {
  const mount = async () => {
    await page.viewport(1200, 1000);
    const { SchemeTool } = await import("./SchemeTool");
    const host = document.createElement("div");
    host.className = "studio";
    host.style.cssText = "position:static;width:900px;max-height:none";
    document.body.append(host);
    const root = createRoot(host);
    act(() => root.render(<SchemeTool onAdd={() => undefined} />));
    const hexes = () =>
      [...host.querySelectorAll(".studio-palette__hex")].map(
        (b) => `#${b.textContent?.toLowerCase()}`
      );
    const done = () => {
      act(() => root.unmount());
      host.remove();
    };
    return { done, hexes, host };
  };

  /** Drags a wheel handle to the point at `hue` on the ring. */
  const dragTo = (host: HTMLElement, label: string, hue: number) => {
    const handle = host.querySelector(`[aria-label="${label}"]`) as HTMLElement;
    const box = (
      host.querySelector(".studio-hue__wheel") as HTMLElement
    ).getBoundingClientRect();
    const rad = (hue * Math.PI) / 180;
    const at = {
      clientX: box.left + box.width / 2 + Math.sin(rad) * 100,
      clientY: box.top + box.height / 2 - Math.cos(rad) * 100,
    };
    const fire = (type: string) =>
      handle.dispatchEvent(
        new PointerEvent(type, { bubbles: true, pointerId: 1, ...at })
      );
    act(() => {
      fire("pointerdown");
      fire("pointermove");
      fire("pointerup");
    });
  };

  it("drags one colour round the wheel and leaves the others", async () => {
    const { done, hexes, host } = await mount();
    const before = hexes();
    dragTo(host, "Colour 3 on the hue wheel", 40);
    const after = hexes();
    expect(hueGap(lch(after[2] ?? "").h, 40)).toBeLessThan(8);
    expect([after[0], after[1], after[3]]).toEqual([
      before[0],
      before[1],
      before[3],
    ]);
    // Double-click gives it back to the settings.
    act(() =>
      (
        host.querySelector(
          '[aria-label="Colour 3 on the hue wheel"]'
        ) as HTMLElement
      ).dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))
    );
    expect(hexes()).toEqual(before);
    done();
  });

  it("turns the whole palette with the anchor's handle", async () => {
    const { done, hexes, host } = await mount();
    const before = hexes().map((c) => lch(c).h);
    dragTo(host, "Anchor on the hue wheel", 150);
    const after = hexes().map((c) => lch(c).h);
    expect(hueGap(after[0] ?? 0, 150)).toBeLessThan(6);
    // The others kept their distance from it.
    expect(
      hueGap(
        (after[1] ?? 0) - (after[0] ?? 0),
        (before[1] ?? 0) - (before[0] ?? 0)
      )
    ).toBeLessThan(15);
    done();
  });

  it("sets the anchor's lightness, chroma and hue from the dials", async () => {
    const { done, hexes, host } = await mount();
    const set = (label: string, value: string) => {
      const input = host.querySelector(
        `[aria-label="${label}"]`
      ) as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set;
      act(() => {
        setter?.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    };
    set("Anchor lightness", "45");
    set("Anchor chroma", "0.1");
    set("Anchor hue", "180");
    const anchor = lch(hexes()[0] ?? "");
    expect(anchor.l).toBeCloseTo(0.45, 1);
    expect(hueGap(anchor.h, 180)).toBeLessThan(6);
    // Down to grey and back: the hue is remembered.
    set("Anchor chroma", "0");
    set("Anchor chroma", "0.1");
    expect(hueGap(lch(hexes()[0] ?? "").h, 180)).toBeLessThan(6);
    done();
  });
});
