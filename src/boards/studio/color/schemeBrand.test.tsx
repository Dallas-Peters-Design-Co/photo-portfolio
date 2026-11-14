import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, it, vi } from "vitest";

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
  useBrandSwatches: () => null,
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
  const well = host.querySelector(
    '[aria-label="Colour 3 colour"]'
  ) as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  )?.set;
  act(() => {
    setter?.call(well, "#aa3311");
    well.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(hexes()).toEqual(["#2f7cf6", "#001a1f", "#aa3311"]);

  await act(async () => {
    press("Save to RoleModel");
    await vi.waitFor(() => expect(saved).toHaveLength(1));
  });
  expect((saved[0] as { palette: unknown }).palette).toEqual([
    PALETTE[0],
    PALETTE[1],
    { name: "Leaf", role: "", value: "#aa3311" },
  ]);
  act(() => root.unmount());
  host.remove();
});
