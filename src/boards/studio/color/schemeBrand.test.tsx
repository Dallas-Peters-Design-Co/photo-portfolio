import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

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
  await page.getByLabelText("Semantic role").selectOptions("danger");
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
