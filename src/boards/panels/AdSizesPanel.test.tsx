import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BoardItem } from "../../types";
import { AdSizesPanel } from "./AdSizesPanel";

/** Checking sizes decides which actions the panel offers. */

const RESIZE = /Resize/;
const STORY = /Story/;
const THUMB = /Thumbnail/;
const TWO_COPIES = /Make 2 copies/;

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

const frame = {
  body: "Instagram · Post · square · 1080×1080",
  id: "f",
  kind: "frame",
} as BoardItem;

const render = (onFit = vi.fn()) => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() =>
    root?.render(
      <AdSizesPanel frame={frame} onCancel={vi.fn()} onFit={onFit} />
    )
  );
  return onFit;
};

const button = (name: RegExp) =>
  [...(host?.querySelectorAll("button") ?? [])].find((b) =>
    name.test(b.textContent ?? "")
  ) as HTMLButtonElement;

const check = (label: RegExp) => {
  const option = [...(host?.querySelectorAll("label") ?? [])].find((l) =>
    label.test(l.textContent ?? "")
  );
  act(() => option?.querySelector("input")?.click());
};

describe("AdSizesPanel", () => {
  it("marks the frame's current size", () => {
    render();
    expect(host?.textContent).toContain("1080×1080 · now");
  });

  it("offers resize for one size and copies for several", () => {
    const onFit = render();
    expect(button(RESIZE).disabled).toBe(true);
    check(STORY);
    expect(button(RESIZE).disabled).toBe(false);
    check(THUMB);
    expect(button(RESIZE).disabled).toBe(true);
    act(() => button(TWO_COPIES).click());
    expect(onFit).toHaveBeenCalledWith(["ig-story", "yt-thumb"], "copy");
  });
});
