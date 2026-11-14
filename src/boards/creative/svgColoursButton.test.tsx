import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import type { BoardItem } from "../../types";
import { SvgColoursButton } from "./SvgColoursButton";

const SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Crect fill='%23ff0000' width='4' height='4'/%3E%3C/svg%3E";

const layer = (imageUrl: string) =>
  ({ id: "a", imageUrl, kind: "reference" }) as unknown as BoardItem;

it("offers Colours for an SVG layer only, and lists its colours", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(<SvgColoursButton item={layer("https://b/a.png")} />));
  expect(host.querySelector("button")).toBeNull();

  act(() => root.render(<SvgColoursButton item={layer(SVG)} />));
  const button = host.querySelector("button") as HTMLElement;
  expect(button.textContent).toContain("Colours");
  await act(async () => {
    button.click();
    await new Promise((r) => setTimeout(r, 100));
  });
  expect(host.querySelector(".creative__popover")?.textContent).toContain(
    "#FF0000"
  );
  act(() => root.unmount());
  host.remove();
});
