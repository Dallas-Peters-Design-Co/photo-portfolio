import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReviewMark, ReviewScreen } from "../../../config/review.js";

vi.mock("../../cms/PageEditor", () => ({ PageEditor: () => null }));

let resolveCapture: ((image: ReviewScreen["image"]) => void) | null = null;
vi.mock("../../services/reviewService", () => ({
  reviewsApi: {
    capture: () =>
      new Promise((resolve) => {
        resolveCapture = (image) => resolve({ image, viewport: "desktop" });
      }),
  },
}));

const { ReviewScreenEditor } = await import("./ReviewScreenEditor");

const BOX: ReviewMark = {
  id: "m1",
  kind: "box",
  points: [
    [0.1, 0.1],
    [0.4, 0.4],
  ],
};

const start: ReviewScreen = {
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

/** The screen as the parent holds it, after every change. */
let current: ReviewScreen = start;
/** Changes the parent's copy directly, as typing in the note list does. */
let setFromOutside: (update: (prev: ReviewScreen) => ReviewScreen) => void =
  () => undefined;

/** Holds the screen in state the way ReviewEditor does. */
function Harness({ initial }: { initial: ReviewScreen }) {
  const [screen, setScreen] = useState(initial);
  current = screen;
  setFromOutside = setScreen;
  return (
    <ReviewScreenEditor
      firstNumber={1}
      onChange={(update) => setScreen((prev) => update(prev))}
      onRemove={() => undefined}
      screen={screen}
      slug="t"
    />
  );
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(async () => {
  await act(() => root?.unmount());
  host?.remove();
});

const mount = async (initial: ReviewScreen = start) => {
  current = initial;
  host = document.createElement("div");
  host.style.width = "800px";
  document.body.append(host);
  root = createRoot(host);
  await act(() => root?.render(<Harness initial={initial} />));
  const el = canvas();
  // The image is a 1x1 gif; give the canvas a size so fractions mean something.
  if (el) {
    el.style.height = "400px";
  }
};

const canvas = () =>
  document.querySelector<HTMLDivElement>("[data-review-canvas]");

const button = (label: string) =>
  document.querySelector<HTMLButtonElement>(`button[aria-label^="${label}"]`);

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

const drawBox = async () => {
  await act(() => button("Box")?.click());
  const el = canvas() as HTMLDivElement;
  await act(() => pointer("pointerdown", el, 0.1, 0.2));
  await act(() => pointer("pointermove", el, 0.5, 0.6));
  await act(() => pointer("pointerup", el, 0.5, 0.6));
};

describe("review markup tools", () => {
  it("draws a box with the Box tool, as fractions of the image", async () => {
    await mount();
    await drawBox();
    expect(current.marks).toHaveLength(1);
    expect(current.marks[0]?.kind).toBe("box");
    const [[x1, y1], [x2, y2]] = current.marks[0]?.points ?? [];
    expect(x1).toBeCloseTo(0.1, 1);
    expect(y1).toBeCloseTo(0.2, 1);
    expect(x2).toBeCloseTo(0.5, 1);
    expect(y2).toBeCloseTo(0.6, 1);
    // Drawing a mark must not also drop a note pin.
    expect(current.pins).toHaveLength(0);
  });

  it("ignores a click without a drag", async () => {
    await mount();
    await act(() => button("Arrow")?.click());
    const el = canvas() as HTMLDivElement;
    await act(() => pointer("pointerdown", el, 0.3, 0.3));
    await act(() => pointer("pointerup", el, 0.3, 0.3));
    expect(current.marks).toHaveLength(0);
  });

  it("still pins a note with the Note tool", async () => {
    await mount();
    await act(() => canvas()?.click());
    expect(current.pins).toHaveLength(1);
  });

  it("undoes and redoes a mark, from the toolbar and the keyboard", async () => {
    await mount();
    await drawBox();
    expect(current.marks).toHaveLength(1);
    await act(() => button("Undo")?.click());
    expect(current.marks).toHaveLength(0);
    await act(() => button("Redo")?.click());
    expect(current.marks).toHaveLength(1);
    await act(() =>
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "z", metaKey: true })
      )
    );
    expect(current.marks).toHaveLength(0);
  });

  it("keeps a note's words when undo moves it back", async () => {
    await mount();
    await act(() => canvas()?.click());
    await drawBox();
    // Typing goes through the list, which is not an undo step.
    await act(() =>
      setFromOutside((prev) => ({
        ...prev,
        pins: prev.pins.map((p) => ({ ...p, title: "Contrast" })),
      }))
    );
    await act(() => button("Undo")?.click());
    expect(current.marks).toHaveLength(0);
    expect(current.pins[0]?.title).toBe("Contrast");
  });

  it("erases a mark and a note with the Eraser, and Clear removes all markup", async () => {
    await mount({
      ...start,
      marks: [BOX, { ...BOX, id: "m2" }],
      pins: [{ body: "", id: "p1", kind: "issue", title: "", x: 0.8, y: 0.8 }],
    });
    await act(() => button("Eraser")?.click());
    const mark = document.querySelector<SVGGElement>(".review-markup__mark");
    await act(() =>
      mark?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    );
    expect(current.marks.map((m) => m.id)).toEqual(["m2"]);
    await act(() => button("Note 1")?.click());
    expect(current.pins).toHaveLength(0);
    const clear = [...document.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Clear markup")
    );
    await act(() => clear?.click());
    expect(current.marks).toHaveLength(0);
  });

  it("keeps pins added while a capture is still running", async () => {
    await mount({ ...start, image: null, sourceUrl: "https://example.com" });
    const url = document.querySelector<HTMLInputElement>('input[type="url"]');
    expect(url?.value).toBe("https://example.com");
    const captureButton = [...document.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Capture")
    );
    await act(() => captureButton?.click());
    // While the browser works, a pin arrives some other way.
    await act(() =>
      setFromOutside((prev) => ({
        ...prev,
        pins: [
          { body: "", id: "p9", kind: "issue", title: "", x: 0.5, y: 0.5 },
        ],
      }))
    );
    await act(async () => {
      resolveCapture?.({
        height: 900,
        url: "https://blob.test/shot.png",
        width: 1440,
      });
      await Promise.resolve();
    });
    expect(current.image?.url).toBe("https://blob.test/shot.png");
    expect(current.pins.map((p) => p.id)).toEqual(["p9"]);
  });
});
