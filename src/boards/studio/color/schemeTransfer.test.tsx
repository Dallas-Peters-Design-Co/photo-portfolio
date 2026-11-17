import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, it, vi } from "vitest";

/**
 * One brand's colours carried to another: loaded from the board's brand,
 * the kit picker switched, and saved into the other kit, names and all.
 */

const ROLEMODEL = [
  { name: "Navy", role: "primary", value: "#041045" },
  { name: "Sky", role: "accent", value: "#2f7cf6" },
];
const kit = (id: string, name: string, palette: typeof ROLEMODEL) => ({
  doc: { palette },
  id,
  name,
  resolvedDoc: { palette },
});
const KITS = [
  kit("kit-1", "RoleModel", ROLEMODEL),
  kit("kit-2", "Pretext", [{ name: "Old", role: "", value: "#ff0000" }]),
];

const saved: { doc: { palette: unknown }; id: string }[] = [];
vi.mock("../../brand/ActiveBrand", () => ({
  useActiveBrand: () => ({ kit: KITS[0], kits: KITS }),
  useBrandSwatches: () => undefined,
}));
vi.mock("../../../hooks/useBrandKits", () => ({
  useBrandKits: () => ({ kits: KITS, refresh: () => Promise.resolve() }),
}));
vi.mock("../../../services/brandKitService", () => ({
  brandKitsApi: {
    save: (id: string, doc: { palette: unknown }) => {
      saved.push({ doc, id });
      return Promise.resolve();
    },
  },
}));

beforeEach(() => localStorage.removeItem("studio:scheme:kit-1"));

it("carries one brand's colours into another kit", async () => {
  const { SchemeTool } = await import("./SchemeTool");
  const host = document.createElement("div");
  document.body.append(host);
  act(() => createRoot(host).render(<SchemeTool onAdd={() => undefined} />));
  const press = (text: string) =>
    act(() =>
      (
        [...host.querySelectorAll("button")].find((b) =>
          b.textContent?.includes(text)
        ) as HTMLElement
      ).click()
    );

  press("Load brand colours");
  act(() =>
    (
      host.querySelector(
        '[aria-label="Brand kit to save to or load from"]'
      ) as HTMLElement
    ).click()
  );
  await vi.waitFor(() => {
    expect(
      [...document.querySelectorAll('[role="option"]')].some((o) =>
        o.textContent?.includes("Pretext")
      )
    ).toBe(true);
  });
  act(() =>
    (
      [...document.querySelectorAll('[role="option"]')].find((o) =>
        o.textContent?.includes("Pretext")
      ) as HTMLElement
    ).click()
  );
  await vi.waitFor(() => expect(host.textContent).toContain("Save to Pretext"));
  await act(async () => {
    press("Save to Pretext");
    await vi.waitFor(() => expect(saved).toHaveLength(1));
  });
  expect(saved[0]?.id).toBe("kit-2");
  expect(saved[0]?.doc.palette).toEqual(ROLEMODEL);
});
