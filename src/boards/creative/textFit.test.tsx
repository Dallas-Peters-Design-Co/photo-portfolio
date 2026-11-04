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
