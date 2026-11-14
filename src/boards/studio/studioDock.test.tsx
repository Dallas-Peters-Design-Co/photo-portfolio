import "./Studio.css";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { sideAt } from "./useStudioDock";

vi.mock("../brand/ActiveBrand", () => ({
  useActiveBrand: () => null,
  useBrandSwatches: () => null,
}));

const { StudioPanel } = await import("./StudioPanel");

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  localStorage.removeItem("studio:dock");
});

const mount = () => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() =>
    root?.render(
      <StudioPanel
        initialTool="gradient"
        onAdd={() => undefined}
        onClose={() => undefined}
      />
    )
  );
  return document.querySelector(".studio") as HTMLElement;
};

const press = (label: string) =>
  act(() =>
    (document.querySelector(`[aria-label="${label}"]`) as HTMLElement).click()
  );

const pageVar = (name: string) =>
  document.documentElement.style.getPropertyValue(name);

it("docks to a side at full height, makes room, and floats again", () => {
  const panel = mount();
  expect(panel.dataset.dock).toBe("float");

  press("Dock on the right");
  const box = panel.getBoundingClientRect();
  expect(panel.dataset.dock).toBe("right");
  expect(Math.round(box.right)).toBe(document.documentElement.clientWidth);
  expect(Math.round(box.top)).toBe(0);
  expect(Math.round(box.height)).toBe(window.innerHeight);
  // What sits beside it (the frame editor) is told how much room it takes.
  expect(pageVar("--studio-dock-right")).toBe(`${Math.round(box.width)}px`);
  expect(pageVar("--studio-dock-left")).toBe("0px");

  press("Dock on the left");
  expect(Math.round(panel.getBoundingClientRect().left)).toBe(0);
  expect(pageVar("--studio-dock-right")).toBe("0px");

  press("Float");
  expect(panel.dataset.dock).toBe("float");
  expect(pageVar("--studio-dock-left")).toBe("0px");
});

it("remembers where it was docked", () => {
  mount();
  press("Dock on the left");
  act(() => root?.unmount());
  host?.remove();
  expect(mount().dataset.dock).toBe("left");
});

it("docks a drag let go at a side of the window", () => {
  expect(sideAt(10, 1400)).toBe("left");
  expect(sideAt(1390, 1400)).toBe("right");
  expect(sideAt(700, 1400)).toBe("float");
});
