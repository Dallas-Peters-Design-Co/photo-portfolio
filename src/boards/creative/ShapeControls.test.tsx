import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import type { BoardItem } from "../../types";
import type { DrawingConfig } from "../drawing/drawing";
import { ShapeControls } from "./ShapeControls";

const rect: DrawingConfig = {
  fill: "#001a1f",
  stroke: "#2f7cf6",
  strokeWidth: 0,
  tool: "rect",
};

const mount = (config: DrawingConfig, onFill?: () => void) => {
  const onPatch = vi.fn<(p: Partial<BoardItem>) => void>();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() =>
    root.render(
      <ShapeControls
        config={config}
        onFillFromStudio={onFill}
        onPatch={onPatch}
      />
    )
  );
  const done = () => {
    act(() => root.unmount());
    host.remove();
  };
  return { done, host, onPatch };
};

const press = (host: HTMLElement, label: string) =>
  act(() =>
    (host.querySelector(`[aria-label="${label}"]`) as HTMLElement).click()
  );

it("puts a border on one side of a box in one click, with a weight", () => {
  const { done, host, onPatch } = mount(rect);
  press(host, "Border on the bottom only");
  expect(onPatch.mock.calls[0]?.[0].config).toMatchObject({
    borderSides: ["bottom"],
    strokeWidth: 8,
  });
  done();
});

it("toggles sides once some are chosen, and four is all round again", () => {
  const { done, host, onPatch } = mount({
    ...rect,
    borderSides: ["top", "right", "left"],
    strokeWidth: 4,
  });
  press(host, "Border on the bottom");
  expect(onPatch.mock.calls[0]?.[0].config?.borderSides).toBeUndefined();
  done();
});

it("offers a Studio fill, and takes one off", () => {
  const onFill = vi.fn();
  const { done, host, onPatch } = mount(
    {
      ...rect,
      fillImage: "https://blob.example/g.png",
      studio: { tool: "gradient" },
    } as DrawingConfig,
    onFill
  );
  expect(host.textContent).toContain("Edit fill");
  press(host, "Take the Studio fill off");
  const config = onPatch.mock.calls[0]?.[0].config;
  expect(config?.fillImage).toBeUndefined();
  expect(config?.studio).toBeNull();
  done();
});
