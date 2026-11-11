import "../../index.css";
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, expect, it } from "vitest";
import { page } from "vitest/browser";
import type { BoardItem } from "../../types";
import { CreativeEditor } from "./CreativeEditor";

/** Text boxes set to fit their words resize to them in the frame editor. */

let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});
beforeAll(async () => {
  await page.viewport(1440, 900);
});

const base = {
  creditName: null,
  creditUrl: null,
  imageUrl: null,
  nodeType: null,
  photoId: null,
  result: null,
  runError: null,
  runState: null,
  textStyle: null,
  thumbUrl: null,
};
const frame = {
  ...base,
  body: "F",
  config: null,
  fontSize: null,
  height: 1080,
  id: "f",
  kind: "frame",
  width: 1080,
  x: 0,
  y: 0,
  z: 0,
} as BoardItem;
const text = (autosize: string, body: string) =>
  ({
    ...base,
    body,
    config: { autosize },
    fontSize: 40,
    height: 400,
    id: "t",
    kind: "text",
    width: 600,
    x: 100,
    y: 100,
    z: 1,
  }) as BoardItem;

let latest: BoardItem[] = [];
function Harness({ start }: { start: BoardItem[] }) {
  const [items, setItems] = useState(start);
  latest = items;
  return (
    <CreativeEditor
      frameId="f"
      items={items}
      onChange={setItems}
      onClose={() => undefined}
    />
  );
}
const render = async (start: BoardItem[]) => {
  host = document.createElement("div");
  host.style.cssText = "width:1200px;height:800px";
  document.body.append(host);
  root = createRoot(host);
  act(() => root?.render(<Harness start={start} />));
  await act(async () => await new Promise((r) => setTimeout(r, 50)));
  return latest.find((i) => i.id === "t") as BoardItem;
};

it("fits the height to the lines, keeping the width", async () => {
  const one = await render([frame, text("height", "One line")]);
  expect(one.width).toBe(600);
  expect(one.height).toBeLessThan(100);
  act(() => root?.unmount());
  host?.remove();
  const three = await render([frame, text("height", "One\nTwo\nThree")]);
  expect(three.height).toBeGreaterThan(one.height * 2.5);
});

it("hugs the text both ways", async () => {
  const t = await render([frame, text("both", "Hi")]);
  expect(t.width).toBeLessThan(150);
  expect(t.height).toBeLessThan(100);
});

it("leaves a fixed box alone", async () => {
  const t = await render([frame, text("fixed", "Hi")]);
  expect(t).toMatchObject({ height: 400, width: 600 });
});

it("hugs a line without wrapping its last word", async () => {
  // offsetWidth rounds, so a line 0.4px wider than its rounded width fitted a
  // box a fraction too narrow and the last word dropped onto a hidden line.
  // Several phrases, so at least one lands on a fractional width.
  const phrases = [
    "Pretext launch kickoff",
    "Systems flow, in and out",
    "Will it fit? Every word",
    "illuminate millimetre",
  ];
  const singleLine = await render([frame, text("both", "Hi")]);
  for (const phrase of phrases) {
    act(() => root?.unmount());
    host?.remove();
    const t = await render([frame, text("both", phrase)]);
    const area = host?.querySelector("textarea") as HTMLTextAreaElement;
    expect(t.height).toBe(singleLine.height);
    expect(area.scrollHeight).toBeLessThanOrEqual(area.clientHeight + 1);
  }
});

it("lets the text box being edited take its own clicks", async () => {
  // Triple-click and drag-select need the press to reach the textarea
  // untouched; the board used to take it for a marquee and cancel it.
  await render([frame, text("fixed", "Select these words")]);
  const layer = host?.querySelector('[data-layer-id="t"]') as HTMLElement;
  act(() => {
    layer.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
  });
  await act(async () => await new Promise((r) => setTimeout(r, 30)));
  const area = host?.querySelector("textarea") as HTMLTextAreaElement;
  expect(area.readOnly).toBe(false);
  const press = new PointerEvent("pointerdown", {
    bubbles: true,
    button: 0,
    cancelable: true,
    clientX: 10,
    clientY: 10,
    pointerId: 1,
  });
  act(() => {
    area.dispatchEvent(press);
  });
  await act(async () => await new Promise((r) => setTimeout(r, 30)));
  expect(press.defaultPrevented).toBe(false);
  expect(
    (host?.querySelector("textarea") as HTMLTextAreaElement).readOnly
  ).toBe(false);
  expect(getComputedStyle(area).userSelect).toBe("text");
});
