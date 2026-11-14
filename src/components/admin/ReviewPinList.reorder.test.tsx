import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import type { ReviewPin } from "../../../config/review.js";
import { ReviewPinList } from "./ReviewPinList";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * A note's number is its place in the list, so reordering the list is the
 * only way to renumber the pins — by dragging the number, by the arrow keys
 * on it, or all at once in reading order.
 */

const pin = (id: string, x: number, y: number): ReviewPin => ({
  body: "",
  id,
  kind: "issue",
  title: id,
  x,
  y,
});

const PINS = [
  pin("low", 0.5, 0.8),
  pin("high", 0.5, 0.1),
  pin("mid", 0.5, 0.4),
];

let root: Root | null = null;
let host: HTMLDivElement | null = null;
const onReorder = vi.fn();
const onUpdate = vi.fn();

const handles = () =>
  [
    // The number handles only, not the kind menus that share the "Note" label.
    ...(host?.querySelectorAll("li button[aria-label$='to move it']") ?? []),
  ] as HTMLButtonElement[];

beforeEach(async () => {
  onReorder.mockClear();
  onUpdate.mockClear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(() =>
    root?.render(
      <ReviewPinList
        firstNumber={1}
        image={{ height: 1440, url: "x", width: 1440 }}
        onRemove={() => undefined}
        onReorder={onReorder}
        onSelect={() => undefined}
        onUpdate={onUpdate}
        pins={PINS}
        selected={null}
      />
    )
  );
});

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

describe("ReviewPinList reordering", () => {
  it("moves a note down with the arrow key on its number", () => {
    act(() => {
      handles()[0]?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" })
      );
    });
    expect(onReorder).toHaveBeenCalledWith(["high", "low", "mid"]);
  });

  it("drops a dragged note where it was dragged to, in one change", () => {
    const rows = () => [...(host?.querySelectorAll("li") ?? [])];
    const data = new DataTransfer();
    act(() => {
      handles()[2]?.dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true })
      );
    });
    act(() => {
      rows()[2]?.dispatchEvent(
        new DragEvent("dragstart", { bubbles: true, dataTransfer: data })
      );
    });
    act(() => {
      rows()[0]?.dispatchEvent(
        new DragEvent("dragover", {
          bubbles: true,
          cancelable: true,
          dataTransfer: data,
        })
      );
    });
    expect(onReorder).not.toHaveBeenCalled();
    act(() => {
      rows()[0]?.dispatchEvent(
        new DragEvent("dragend", { bubbles: true, dataTransfer: data })
      );
    });
    expect(onReorder).toHaveBeenCalledTimes(1);
    expect(onReorder).toHaveBeenCalledWith(["mid", "low", "high"]);
  });

  it("renumbers top to bottom in one click", () => {
    const button = [...(host?.querySelectorAll("button") ?? [])].find((b) =>
      b.textContent?.includes("Number top to bottom")
    );
    act(() => {
      button?.click();
    });
    expect(onReorder).toHaveBeenCalledWith(["high", "mid", "low"]);
  });
});

describe("ReviewPinList kind menu", () => {
  it("shows the kind's label and changes it from the menu", async () => {
    const trigger = host?.querySelector<HTMLButtonElement>(
      "button[aria-label='Note 1 kind']"
    );
    expect(trigger?.textContent).toContain("Issue");
    if (!trigger) {
      return;
    }
    await userEvent.click(trigger);
    const option = await vi.waitFor(() => {
      const found = [...document.querySelectorAll("[role='option']")].find(
        (o) => o.textContent?.includes("Works well")
      );
      if (!found) {
        throw new Error("menu not open");
      }
      return found as HTMLElement;
    });
    await userEvent.click(option);
    expect(onUpdate).toHaveBeenCalledWith("low", { kind: "praise" });
  });
});
