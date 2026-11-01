import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { hexToOklch } from "../../../lib/oklch";
import { generatePalette, mainColors } from "./harmony";
import { rampOf, rampsCss, rampsJson, STEPS } from "./ramp";
import { swatchesSvg } from "./swatches";

const save = vi.fn(async (_id: string, doc: unknown) => ({ doc }));
const refresh = vi.fn(async () => undefined);
const kit = {
  doc: {
    palette: [
      { name: "Flush Mahogany", role: "primary", value: "#c63b2e" },
      { name: "Parchment", role: "surface", value: "#efe6d2" },
    ],
    voice: "kept",
  },
  id: "k1",
  name: "Unruly Chain",
  resolvedDoc: {
    palette: [
      { name: "Flush Mahogany", role: "primary", value: "#c63b2e" },
      { name: "Parchment", role: "surface", value: "#efe6d2" },
    ],
  },
};

vi.mock("../../brand/ActiveBrand", () => ({
  useActiveBrand: () => ({ kit, kits: [kit], setKitId: () => undefined }),
  useBrandSwatches: () => null,
}));
vi.mock("../../../hooks/useBrandKits", () => ({
  useBrandKits: () => ({ kits: [kit], refresh }),
}));
vi.mock("../../../services/brandKitService", () => ({
  brandKitsApi: { save: (id: string, doc: unknown) => save(id, doc) },
}));

const { PaletteTool } = await import("./PaletteTool");
const { StudioPanel } = await import("../StudioPanel");

const HEX = /^#[0-9a-f]{6}$/;

describe("Color ramps", () => {
  it("gives eleven steps, light to dark, with the colour itself at its step", () => {
    const ramp = rampOf("#c63b2e", "mahogany", { hueShift: 0, saturation: 1 });
    expect(ramp?.colors).toHaveLength(STEPS.length);
    expect(ramp?.colors[ramp.baseIndex]).toBe("#c63b2e");
    const ls = ramp?.colors.map((c) => hexToOklch(c)?.l ?? 0) ?? [];
    for (let i = 1; i < ls.length; i += 1) {
      expect(ls[i]).toBeLessThan(ls[i - 1] ?? 1);
    }
    for (const c of ramp?.colors ?? []) {
      expect(c).toMatch(HEX);
    }
  });

  it("writes CSS variables, a Tailwind theme and JSON", () => {
    const ramp = rampOf("#3d564a", "green", { hueShift: 10, saturation: 1.2 });
    const ramps = ramp ? [ramp] : [];
    expect(rampsCss(ramps, "root")).toContain(":root {\n  --color-green-50: #");
    expect(rampsCss(ramps, "theme")).toContain("@theme {");
    expect(JSON.parse(rampsJson(ramps)).green["950"]).toMatch(HEX);
  });

  it("charts ramps as a valid SVG", () => {
    const ramp = rampOf("#354151", "oxford", { hueShift: 0, saturation: 1 });
    const { svg, w } = swatchesSvg([
      { colors: ramp?.colors ?? [], label: "oxford", steps: [...STEPS] },
    ]);
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    expect(doc.querySelector("parsererror")).toBeNull();
    expect(w).toBeGreaterThan(1000);
  });
});

describe("Palette generator", () => {
  it("keeps locked colours and fills the rest", () => {
    let n = 0;
    const rand = () => {
      n = (n * 9301 + 49_297) % 233_280;
      return n / 233_280;
    };
    for (const harmony of ["random", "analogous", "monochrome"] as const) {
      const out = generatePalette(
        ["#c63b2e", null, null, null, null],
        harmony,
        rand
      );
      expect(out[0]).toBe("#c63b2e");
      expect(out).toHaveLength(5);
      for (const c of out) {
        expect(c).toMatch(HEX);
      }
    }
  });

  it("finds a picture's main colours", () => {
    const px: [number, number, number][] = [
      ...Array.from(
        { length: 50 },
        () => [250, 250, 245] as [number, number, number]
      ),
      ...Array.from(
        { length: 50 },
        () => [20, 30, 40] as [number, number, number]
      ),
    ];
    expect(mainColors(px, 2)).toEqual(["#fafaf5", "#141e28"]);
  });
});

describe("Studio colour tools", () => {
  let host: HTMLDivElement | null = null;
  let root: Root | null = null;
  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    save.mockClear();
  });

  const mount = (node: React.ReactNode) => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    act(() => root?.render(node));
    return host;
  };
  const button = (el: HTMLElement, text: string) =>
    [...el.querySelectorAll("button")].find((b) =>
      b.textContent?.includes(text)
    ) as HTMLButtonElement;
  const hexes = (el: HTMLElement) =>
    [...el.querySelectorAll(".studio-palette__hex")].map((b) => b.textContent);

  it("starts from the brand palette, generates on Space, and keeps locks", () => {
    const el = mount(<PaletteTool onAdd={() => undefined} />);
    expect(hexes(el)).toEqual(["C63B2E", "EFE6D2"]);
    act(() =>
      (el.querySelector('[aria-label="Lock #c63b2e"]') as HTMLElement).click()
    );
    act(() => {
      document.activeElement?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, code: "Space" })
      );
    });
    const after = hexes(el);
    expect(after[0]).toBe("C63B2E");
    expect(after[1]).not.toBe("EFE6D2");
  });

  it("saves the palette to the kit, keeping names of colours it already had", async () => {
    const el = mount(<PaletteTool onAdd={() => undefined} />);
    act(() =>
      (el.querySelector('[aria-label="Add a colour"]') as HTMLElement).click()
    );
    await act(async () => {
      button(el, "Save to Unruly Chain").click();
      await vi.waitFor(() => expect(save).toHaveBeenCalled());
    });
    const [id, doc] = save.mock.calls[0] as [
      string,
      {
        palette: { name: string; role: string; value: string }[];
        voice: string;
      },
    ];
    expect(id).toBe("k1");
    expect(doc.voice).toBe("kept");
    expect(doc.palette).toHaveLength(3);
    expect(doc.palette[0]).toEqual(kit.doc.palette[0]);
    expect(doc.palette[2]?.name).toBe("");
    expect(doc.palette[2]?.value).toMatch(HEX);
  });

  it("shows a ramp per brand colour in the Studio", () => {
    const el = mount(
      <StudioPanel
        initialTool="ramps"
        onAdd={() => undefined}
        onClose={() => undefined}
      />
    );
    expect(el.querySelector('[aria-pressed="true"]')?.textContent).toBe(
      "Color Ramps"
    );
    expect(el.querySelectorAll(".studio-ramps__chip")).toHaveLength(22);
    expect(el.querySelectorAll(".studio-ramps__chip--base")).toHaveLength(2);
    expect(el.textContent).toContain("flush-mahogany");
  });
});
