import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

/**
 * The brand's own colours loaded into the Palette Builder, one changed, and
 * saved back: the others exactly as they were, and every name kept.
 */

const PALETTE = [
  { name: "Blue", role: "primary", value: "#2f7cf6" },
  { name: "Ink", role: "text", value: "#001a1f" },
  { name: "Leaf", role: "", value: "#1fa85a" },
];

const saved: unknown[] = [];
vi.mock("../../brand/ActiveBrand", () => ({
  useActiveBrand: () => ({
    kit: {
      doc: { palette: PALETTE },
      id: "kit-1",
      name: "RoleModel",
      resolvedDoc: { palette: PALETTE },
    },
  }),
  useBrandSwatches: () => undefined,
}));
vi.mock("../../../hooks/useBrandKits", () => ({
  useBrandKits: () => ({ refresh: () => Promise.resolve() }),
}));
vi.mock("../../../services/brandKitService", () => ({
  brandKitsApi: {
    save: (_id: string, doc: unknown) => {
      saved.push(doc);
      return Promise.resolve();
    },
  },
}));

beforeEach(() => localStorage.removeItem("studio:scheme:kit-1"));

it("loads the brand's colours, changes one, and saves them back named", async () => {
  const { SchemeTool } = await import("./SchemeTool");
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(<SchemeTool onAdd={() => undefined} />));
  const press = (text: string) =>
    act(() =>
      (
        [...host.querySelectorAll("button")].find((b) =>
          b.textContent?.includes(text)
        ) as HTMLElement
      ).click()
    );
  const hexes = () =>
    [...host.querySelectorAll(".studio-palette__hex")].map(
      (b) => `#${b.textContent?.toLowerCase()}`
    );

  press("Load brand colours");
  expect(hexes()).toEqual(PALETTE.map((p) => p.value));
  expect(host.textContent).toContain("Leaf");

  // Change the third colour with its colour well.
  act(() =>
    (host.querySelector('[aria-label="Edit colour 3"]') as HTMLElement).click()
  );
  // The well opens the OKLCH picker; its text field takes a hex value.
  act(() =>
    (
      host.querySelector('[aria-label="Colour 3 colour"]') as HTMLElement
    ).click()
  );
  const field = document.querySelector(".oklch__text") as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  )?.set;
  act(() => {
    setter?.call(field, "#aa3311");
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(hexes()).toEqual(["#2f7cf6", "#001a1f", "#aa3311"]);

  act(() =>
    (document.querySelector(".color-well__scrim") as HTMLButtonElement).click()
  );
  await page.getByLabelText("Semantic role").fill("danger");
  expect(
    host.querySelectorAll(".studio-palette__swatch")[2]?.textContent
  ).toContain("Danger");
  await page.getByText("Check contrast", { exact: true }).click();
  await page
    .getByLabelText("Foreground", { exact: true })
    .selectOptions("#000000");
  const result = host.querySelector(".studio-scheme__checks output");
  expect(result?.textContent).toContain("21.00:1");
  expect(result?.textContent).toContain("Normal text (4.5:1) · Pass");
  await page
    .getByLabelText("Background", { exact: true })
    .selectOptions("#000000");
  expect(result?.textContent).toContain("Large text (3:1) · Fail");

  await act(async () => {
    press("Save to RoleModel");
    await vi.waitFor(() => expect(saved).toHaveLength(1));
  });
  expect((saved[0] as { palette: unknown }).palette).toEqual([
    PALETTE[0],
    PALETTE[1],
    { id: expect.any(String), name: "Leaf", role: "danger", value: "#aa3311" },
  ]);
  act(() => root.unmount());
  host.remove();
});

it("keeps shared tone, independent wheel hues, variable identities and bar order across a save", async () => {
  const { SchemeTool } = await import("./SchemeTool");
  const { paletteIds } = await import("../../../../config/paletteBinding.js");
  const { hexToOklch } = await import("../../../lib/oklch");
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(<SchemeTool onAdd={() => undefined} />));
  try {
    await page.getByRole("button", { name: "Load brand colours" }).click();
    const group = page.getByLabelText("Hue group");
    await group.fill("Status");
    await userEvent.keyboard("{Enter}");
    await page
      .getByRole("button", { exact: true, name: "Edit colour 3" })
      .click();
    await page.getByLabelText("Swatch name").fill("Approved");
    await page.getByLabelText("Semantic role").fill("approved");
    await group.fill("Status");
    await userEvent.keyboard("{Enter}");
    const slider = page.getByRole("slider", {
      name: "Approved on the hue wheel",
    });
    const dial = () => slider.element().getAttribute("aria-valuenow");
    const oldHue = Number(dial());
    await slider.click();
    await userEvent.keyboard("{Shift>}{ArrowRight}{/Shift}");
    expect(Number(dial())).toBe((oldHue + 10) % 360);
    await page.getByRole("button", { name: "Move left" }).click();
    await page.getByRole("button", { name: "Save to RoleModel" }).click();
    const { palette } = saved.at(-1) as {
      palette: ((typeof PALETTE)[number] & { group?: string; id: string })[];
    };
    expect(palette.map((e) => e.name)).toEqual(["Blue", "Approved", "Ink"]);
    expect(palette.map((e) => e.id)).toEqual([
      paletteIds(PALETTE)[0],
      paletteIds(PALETTE)[2],
      paletteIds(PALETTE)[1],
    ]);
    expect(palette[0].group).toBe("Status");
    expect(palette[1].group).toBe("Status");
    expect(palette[2].value).toBe(PALETTE[1].value);
    const first = hexToOklch(palette[0].value);
    const second = hexToOklch(palette[1].value);
    if (!(first && second)) {
      throw new Error("Expected two saved hex colors");
    }
    expect(first.l).toBeCloseTo(second.l, 2);
    expect(first.c).toBeCloseTo(second.c, 2);
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});

it("edits the group's lightness endpoints and saves evenly spaced shades of its hue", async () => {
  const { SchemeTool } = await import("./SchemeTool");
  const { sanitizeKitDoc } = await import("../../../../config/brandKit.js");
  const { hexToOklch } = await import("../../../lib/oklch");
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(<SchemeTool onAdd={() => undefined} />));
  try {
    await page.getByRole("button", { name: "Load brand colours" }).click();
    const group = page.getByLabelText("Hue group");
    const assign = async (label: string) => {
      await page.getByRole("button", { exact: true, name: label }).click();
      await group.fill("Leaf shades");
      await userEvent.keyboard("{Enter}");
    };
    await assign("Edit anchor, primary");
    await assign("Edit colour 2, text");
    await assign("Edit colour 3");
    await page.getByLabelText("Same-hue lightness ramp").click();
    await page.getByLabelText("Minimum lightness", { exact: true }).fill("30");
    await page.getByLabelText("Maximum lightness", { exact: true }).fill("80");
    await page.getByRole("button", { name: "Move left" }).click();
    await page.getByRole("button", { name: "Add shade" }).click();
    await page.getByRole("button", { name: "Save to RoleModel" }).click();
    const { palette } = sanitizeKitDoc(saved.at(-1));
    expect(palette.map((e) => e.name)).toEqual(["Blue", "Leaf", "Ink", ""]);
    for (const [i, entry] of palette.entries()) {
      expect(entry.ramp).toMatchObject({ max: 0.8, min: 0.3 });
      const color = hexToOklch(entry.value);
      expect(color?.l).toBeCloseTo(0.3 + (i * 0.5) / 3, 2);
      expect(
        Math.abs((color?.h ?? -999) - (entry.ramp?.h ?? 999))
      ).toBeLessThan(2);
    }
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
