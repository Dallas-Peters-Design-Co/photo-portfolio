import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import type { TypeScale } from "../../../config/typeScale.js";
import { TypeScaleEditor } from "./TypeScaleEditor";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * A style's weight is a number: picking one from the menu must store the
 * number, not the label it is shown as.
 */

const SCALE: TypeScale = {
  spacing: [],
  styles: [
    {
      case: "none",
      face: "body",
      lineHeight: 1.5,
      name: "body",
      size: 16,
      tracking: 0,
      weight: 400,
    },
  ],
};

const onChange = vi.fn();
let host: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(async () => {
  onChange.mockClear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(() =>
    root?.render(
      <TypeScaleEditor faces={{}} onChange={onChange} value={SCALE} />
    )
  );
});

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

describe("TypeScaleEditor weight menu", () => {
  it("shows the weight and stores the chosen one as a number", async () => {
    const trigger = host?.querySelector<HTMLButtonElement>(
      "button[aria-label='body weight']"
    );
    expect(trigger?.textContent).toContain("400");
    if (!trigger) {
      return;
    }
    await userEvent.click(trigger);
    const option = await vi.waitFor(() => {
      const found = [...document.querySelectorAll("[role='option']")].find(
        (o) => o.textContent?.trim() === "700"
      );
      if (!found) {
        throw new Error("menu not open");
      }
      return found as HTMLElement;
    });
    await userEvent.click(option);
    expect(onChange).toHaveBeenCalledWith({
      ...SCALE,
      styles: [{ ...SCALE.styles[0], weight: 700 }],
    });
  });
});
