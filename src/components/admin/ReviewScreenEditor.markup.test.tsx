import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReviewScreen } from "../../../config/review.js";

vi.mock("../../cms/PageEditor", () => ({ PageEditor: () => null }));
const { ReviewScreenEditor } = await import("./ReviewScreenEditor");

const screen: ReviewScreen = {
  id: "s",
  image: {
    height: 500,
    url: "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
    width: 1000,
  },
  marks: [],
  note: "",
  pins: [],
  sourceUrl: "",
  title: "Home",
  viewport: "desktop",
};

let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(async () => {
  await act(() => root?.unmount());
  host?.remove();
});

const mount = async (onChange: (s: ReviewScreen) => void) => {
  host = document.createElement("div");
  host.style.width = "800px";
  document.body.append(host);
  root = createRoot(host);
  await act(() => {
    root?.render(
      <ReviewScreenEditor
        firstNumber={1}
        onChange={onChange}
        onRemove={() => undefined}
        screen={screen}
        slug="t"
      />
    );
  });
};

const canvas = () =>
  document.querySelector<HTMLDivElement>(
    "div.cursor-crosshair"
  ) as HTMLDivElement;

const pointer = (type: string, el: HTMLElement, fx: number, fy: number) => {
  const box = el.getBoundingClientRect();
  el.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      button: 0,
      clientX: box.left + box.width * fx,
      clientY: box.top + box.height * fy,
      pointerId: 1,
    })
  );
};

describe("review markup tools", () => {
  it("draws a box with the Box tool, as fractions of the image", async () => {
    const onChange = vi.fn();
    await mount(onChange);
    const boxTool = document.querySelector<HTMLButtonElement>(
      'button[aria-label^="Box"]'
    );
    await act(() => boxTool?.click());
    const el = canvas();
    // The image is a 1x1 gif; give the canvas a size so fractions mean something.
    el.style.height = "400px";
    await act(() => pointer("pointerdown", el, 0.1, 0.2));
    await act(() => pointer("pointermove", el, 0.5, 0.6));
    await act(() => pointer("pointerup", el, 0.5, 0.6));
    const next = onChange.mock.calls.at(-1)?.[0] as ReviewScreen;
    expect(next.marks).toHaveLength(1);
    expect(next.marks[0]?.kind).toBe("box");
    const [[x1, y1], [x2, y2]] = next.marks[0]?.points ?? [];
    expect(x1).toBeCloseTo(0.1, 1);
    expect(y1).toBeCloseTo(0.2, 1);
    expect(x2).toBeCloseTo(0.5, 1);
    expect(y2).toBeCloseTo(0.6, 1);
    // Drawing a mark must not also drop a note pin.
    expect(next.pins).toHaveLength(0);
  });

  it("ignores a click without a drag", async () => {
    const onChange = vi.fn();
    await mount(onChange);
    await act(() =>
      document
        .querySelector<HTMLButtonElement>('button[aria-label^="Arrow"]')
        ?.click()
    );
    const el = canvas();
    el.style.height = "400px";
    await act(() => pointer("pointerdown", el, 0.3, 0.3));
    await act(() => pointer("pointerup", el, 0.3, 0.3));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("still pins a note with the Note tool", async () => {
    const onChange = vi.fn();
    await mount(onChange);
    const el = canvas();
    el.style.height = "400px";
    await act(() => el.click());
    const next = onChange.mock.calls.at(-1)?.[0] as ReviewScreen;
    expect(next.pins).toHaveLength(1);
  });
});
