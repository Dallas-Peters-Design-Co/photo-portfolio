import "../../index.css";
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { vi } from "vitest";
import { EMPTY_KIT } from "../../../config/brandKit.js";
import { createConceptElement } from "../../../config/conceptDefaults.js";
import { lookOf } from "../../../config/conceptStyle.js";
import type { PageDesign } from "../../../config/pageDesign.js";
import { BLANK_ITEM } from "../../components/admin/boardEditor/placement";
import type { BoardItem } from "../../types";
import { PageCanvasEditor } from "./PageCanvasEditor";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

export const kit = {
  id: "12345678-1234-1234-1234-123456789012",
  name: "Pretext",
  resolvedDoc: {
    ...EMPTY_KIT,
    componentStyles: [
      {
        id: "primary",
        kind: "button" as const,
        look: lookOf(createConceptElement("button")),
        name: "Primary",
      },
    ],
    palette: [{ name: "Harbor", role: "Accent", value: "#114477" }],
  },
};
export const changed = vi.fn();
export const closed = vi.fn();
export let latest: PageDesign | null = null;
export const frame: BoardItem = {
  ...BLANK_ITEM,
  body: "Results & findings",
  height: 450,
  id: "frame",
  kind: "frame",
  width: 720,
  x: 0,
  y: 0,
  z: 0,
};
function Harness({ initial }: { initial?: PageDesign }) {
  const [item, setItem] = useState({
    ...frame,
    config: initial ? { pageDesign: initial } : null,
  });
  return (
    <PageCanvasEditor
      frame={item}
      onChange={(next) => {
        latest = next;
        changed(next);
        setItem({ ...item, config: { pageDesign: next } });
      }}
      onClose={closed}
    />
  );
}
export let host: HTMLDivElement;
export let root: Root;
export const mount = async (initial?: PageDesign) => {
  changed.mockClear();
  closed.mockClear();
  latest = null;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(() => root.render(<Harness initial={initial} />));
};
export const cleanup = async () => {
  await act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
};
