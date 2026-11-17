import "../../index.css";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import type { BoardItem } from "../../types";
import { VectorToolBar } from "./VectorToolBar";

const shape = {
  config: {
    d: "M20 20L60 20L60 60L20 60ZM100 10L110 10L110 60L100 60Z",
    fill: "#000",
    tool: "vector",
    viewHeight: 100,
    viewWidth: 200,
  },
  height: 100,
  id: "v1",
  kind: "drawing",
  width: 200,
  x: 0,
  y: 0,
} as unknown as BoardItem;

it("fits the box and ungroups a vector shape on the board", () => {
  const host = document.createElement("div");
  document.body.append(host);
  const onPatch = vi.fn();
  const onReplace = vi.fn();
  act(() =>
    createRoot(host).render(
      <VectorToolBar
        anchor={{ current: host }}
        chromeScale={{ transform: "scale(1)" }}
        item={shape}
        onPatch={onPatch}
        onReplace={onReplace}
      />
    )
  );
  const button = (label: string) =>
    [...host.querySelectorAll("button")].find((b) => b.textContent === label);
  button("Fit box")?.click();
  expect(onPatch.mock.calls[0]?.[0]).toMatchObject({ width: 90, x: 20, y: 10 });
  button("Ungroup")?.click();
  expect(onReplace.mock.calls[0]?.[0]).toHaveLength(2);
  host.remove();
});
