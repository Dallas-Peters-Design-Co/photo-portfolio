import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AD_SIZES, sizeOfTitle, sizeTitle } from "../../../config/adLayout";
import type { BoardItem } from "../../types";
import { FrameGuides } from "./FrameGuides";
import { guidesOf } from "./frameGuides";
import { snapMove } from "./snap";

let host: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  host = null;
});

const frameOf = (
  title: string,
  config: Record<string, unknown> | null = null
): BoardItem =>
  ({
    body: title,
    config,
    height: 198,
    id: "f",
    kind: "frame",
    width: 792,
    x: 100,
    y: 50,
  }) as unknown as BoardItem;

const mount = (frame: BoardItem, onCommit = vi.fn()) => {
  host = document.createElement("div");
  host.style.cssText = "position:absolute;left:40px;top:40px";
  document.body.append(host);
  root = createRoot(host);
  act(() =>
    root?.render(<FrameGuides frame={frame} onCommit={onCommit} scale={1} />)
  );
  return onCommit;
};

const pointer = (type: string, x: number, y: number) =>
  new PointerEvent(type, {
    bubbles: true,
    button: 0,
    cancelable: true,
    clientX: x,
    clientY: y,
    pointerId: 1,
  });

describe("social sizes", () => {
  it("covers every platform asked for, with unique ids and titles", () => {
    const groups = new Set(AD_SIZES.map((s) => s.group));
    for (const g of [
      "Instagram",
      "Facebook",
      "LinkedIn",
      "X",
      "TikTok",
      "YouTube",
      "ChatGPT",
      "Google Business",
    ]) {
      expect(groups.has(g)).toBe(true);
    }
    expect(new Set(AD_SIZES.map((s) => s.id)).size).toBe(AD_SIZES.length);
    expect(new Set(AD_SIZES.map(sizeTitle)).size).toBe(AD_SIZES.length);
  });

  it("keeps every safe zone inside its size", () => {
    for (const s of AD_SIZES) {
      const inset = s.safe?.inset;
      if (inset) {
        expect(inset.left + inset.right).toBeLessThan(s.w);
        expect(inset.top + inset.bottom).toBeLessThan(s.h);
      }
    }
  });

  it("finds a frame's size, and its safe zone, from its title", () => {
    const size = sizeOfTitle("YouTube · Channel banner · 2560×1440");
    expect(size?.safe?.inset?.left).toBe(507);
    expect(sizeOfTitle("Something else")).toBeNull();
  });
});

describe("FrameGuides", () => {
  it("shades a social size's safe zone and marks what covers it", () => {
    mount(frameOf("LinkedIn · Banner · 1584×396"));
    expect(host?.querySelector(".frame-guides__zone")).not.toBeNull();
    expect(host?.querySelector(".frame-guides__cover")?.textContent).toBe(
      "Profile photo"
    );
  });

  it("hides the safe zone when the frame says so", () => {
    mount(
      frameOf("LinkedIn · Banner · 1584×396", {
        guides: { hideSafe: true, x: [], y: [] },
      })
    );
    expect(host?.querySelector(".frame-guides__zone")).toBeNull();
  });

  it("drags a new horizontal guide off the top ruler and keeps it on the frame", () => {
    const commit = mount(
      frameOf("LinkedIn · Banner · 1584×396", { brand: "kept" })
    );
    const ruler = host?.querySelector(
      ".frame-guides__ruler--top"
    ) as HTMLElement;
    const box = (
      document.querySelector(".frame-guides") as HTMLElement
    ).getBoundingClientRect();
    act(() => {
      ruler.dispatchEvent(pointer("pointerdown", box.left + 100, box.top - 10));
      ruler.dispatchEvent(
        pointer("pointermove", box.left + 100, box.top + box.height / 4)
      );
      ruler.dispatchEvent(
        pointer("pointerup", box.left + 100, box.top + box.height / 4)
      );
    });
    expect(commit).toHaveBeenCalledOnce();
    const [id, patch] = commit.mock.calls[0] as [string, Partial<BoardItem>];
    expect(id).toBe("f");
    expect(patch.config?.brand).toBe("kept");
    const set = guidesOf(patch);
    expect(set.y).toHaveLength(1);
    expect(set.y[0]).toBeCloseTo(0.25, 2);
  });

  it("takes a guide away when it's dragged off the frame", () => {
    const commit = mount(frameOf("Plain", { guides: { x: [0.3], y: [] } }));
    const guide = host?.querySelector(".frame-guides__guide--x") as HTMLElement;
    const box = (
      document.querySelector(".frame-guides") as HTMLElement
    ).getBoundingClientRect();
    act(() => {
      guide.dispatchEvent(
        pointer("pointerdown", box.left + box.width * 0.3, box.top + 20)
      );
      guide.dispatchEvent(pointer("pointermove", box.left - 40, box.top + 20));
      guide.dispatchEvent(pointer("pointerup", box.left - 40, box.top + 20));
    });
    const [, patch] = commit.mock.calls[0] as [string, BoardItem];
    expect(guidesOf(patch).x).toEqual([]);
  });
});

describe("snapping to guides", () => {
  it("pulls a layer's edge onto a guide", () => {
    const frame = {
      config: { guides: { x: [0.3], y: [] } },
      height: 100,
      width: 400,
      x: 0,
      y: 0,
    };
    // The guide is at x 120; nothing else is near.
    const near = snapMove(
      { height: 10, width: 30, x: 88, y: 40 },
      frame,
      [],
      6
    );
    expect(near.box.x).toBe(90);
    expect(near.guides.x).toEqual([120]);
    const bare = { ...frame, config: null };
    const plain = snapMove(
      { height: 10, width: 30, x: 88, y: 40 },
      bare,
      [],
      6
    );
    expect(plain.box.x).toBe(88);
  });
});

describe("renamed sizes", () => {
  it("still finds the size of a frame made before its label changed", () => {
    expect(sizeOfTitle("LinkedIn · Banner · 1584×396")?.id).toBe("li-banner");
    expect(
      sizeOfTitle("LinkedIn · Profile banner · 1584×396")?.safe
    ).toBeTruthy();
  });
});
