import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import type { BoardItem } from "../../types";
import { ColorWell } from "../ColorWell";
import { ColorVarsProvider } from "./ColorVarsContext";
import type { ColorVar } from "./colorVars";
import { useColorVars } from "./useColorVars";

/** A colour picker on a board with variables, and changing one of them. */
const vars: ColorVar[] = [
  { id: "lime", name: "Lime", value: "#c5cf3a" },
  { id: "navy", name: "Navy", value: "#1e3dff" },
];
const items = [
  { config: { fill: "#c5cf3a", stroke: "#000000" }, id: "s", kind: "drawing" },
  { config: null, id: "t", kind: "text", textStyle: { color: "#C5CF3A80" } },
] as unknown as BoardItem[];

let api: ReturnType<typeof useColorVars> = null;
function Grab() {
  api = useColorVars();
  return null;
}

it("uses a variable from the picker and changes its colour everywhere", async () => {
  const change = vi.fn();
  const save = vi.fn();
  const picked = vi.fn();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <ColorVarsProvider doc={{ change, latest: () => items, save, vars }}>
        <ColorWell label="Fill" onChange={picked} value="#c5cf3a" />
        <Grab />
      </ColorVarsProvider>
    )
  );

  // The well knows it's a variable, and the picker offers the others.
  const well = host.querySelector<HTMLButtonElement>(".color-well__swatch");
  expect(well?.dataset.var).toBe("");
  expect(well?.title).toContain("Lime");
  await act(async () => well?.click());
  const navy = document.querySelector<HTMLButtonElement>(
    '.color-vars-row__swatch[aria-label="Navy"]'
  );
  await act(async () => navy?.click());
  expect(picked).toHaveBeenCalledWith("#1e3dff");

  // Lime changes: every layer in lime follows, keeping its transparency.
  await act(async () => api?.setValue("lime", "#8fd6e8"));
  const next = change.mock.calls[0]?.[0] as BoardItem[];
  expect(next[0]?.config).toEqual({ fill: "#8fd6e8", stroke: "#000000" });
  expect(next[1]?.textStyle?.color).toBe("#8fd6e880");
  expect(save).toHaveBeenCalledWith([
    { id: "lime", name: "Lime", value: "#8fd6e8" },
    vars[1],
  ]);

  // Two variables can't become the same colour.
  change.mockClear();
  await act(async () => api?.setValue("lime", "#1E3DFF"));
  expect(change).not.toHaveBeenCalled();
  root.unmount();
});
