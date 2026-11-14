import "../../index.css";
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { page } from "vitest/browser";
import type { BoardItem } from "../../types";
import { CreativeEditor } from "./CreativeEditor";

const base = {
  body: null,
  config: null,
  creditName: null,
  creditUrl: null,
  fontSize: null,
  imageUrl: null,
  nodeType: null,
  photoId: null,
  result: null,
  runError: null,
  runState: null,
  textStyle: null,
  thumbUrl: null,
};
const X = 12_345.6;
const Y = -2210.3;
const start: BoardItem[] = [
  {
    ...base,
    body: "LinkedIn · Profile banner · 1584×396",
    config: { designed: true },
    height: 396,
    id: "f",
    kind: "frame",
    width: 1584,
    x: X,
    y: Y,
    z: 0,
  },
  {
    ...base,
    config: { fill: "#001a1f", stroke: "#fff", strokeWidth: 0, tool: "rect" },
    height: 396,
    id: "bg",
    kind: "drawing",
    width: 1584,
    x: X,
    y: Y,
    z: 1,
  },
  {
    ...base,
    body: "AI that fits",
    config: { autosize: "both" },
    fontSize: 120,
    height: 150,
    id: "t1",
    kind: "text",
    textStyle: { align: "center", weight: 700 },
    width: 700,
    x: X + 300.4,
    y: Y + 80.2,
    z: 2,
  },
  {
    ...base,
    body: "A longer line of supporting copy that wraps",
    config: { autosize: "height" },
    fontSize: 36,
    height: 90,
    id: "t2",
    kind: "text",
    width: 500,
    x: X + 300,
    y: Y + 250,
    z: 3,
  },
  {
    ...base,
    body: "Plain fixed text",
    fontSize: 30,
    height: 60,
    id: "t3",
    kind: "text",
    width: 300,
    x: X + 900,
    y: Y + 300,
    z: 4,
  },
  {
    ...base,
    body: "Logo",
    height: 140,
    id: "g",
    kind: "frame",
    width: 420,
    x: X + 1150,
    y: Y + 230,
    z: 5,
  },
  {
    ...base,
    height: 100,
    id: "logo",
    imageUrl:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='100'/%3E",
    kind: "reference",
    width: 400,
    x: X + 1160,
    y: Y + 250,
    z: 6,
  },
] as unknown as BoardItem[];

let latest: BoardItem[] = start;
let writes = 0;
function Harness({ items0 }: { items0: BoardItem[] }) {
  const [items, setItems] = useState(items0);
  latest = items;
  return (
    <CreativeEditor
      frameId="f"
      items={items}
      onChange={(next) => {
        writes += 1;
        setItems(next);
      }}
      onClose={() => undefined}
    />
  );
}

const geo = (list: BoardItem[]) =>
  Object.fromEntries(list.map((i) => [i.id, [i.x, i.y, i.width, i.height]]));

/** Opens the editor on a board, lets it settle, and closes it. */
const open = async (items: BoardItem[]): Promise<BoardItem[]> => {
  const host = document.createElement("div");
  host.style.cssText = "width:1200px;height:800px";
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(<Harness items0={items} />));
  await act(async () => {
    await new Promise((r) => setTimeout(r, 400));
    await document.fonts.ready;
    await new Promise((r) => setTimeout(r, 200));
  });
  const after = latest;
  act(() => root.unmount());
  host.remove();
  return after;
};

/**
 * Opening the frame editor must not move anything. Text boxes set to fit
 * their words are the one thing it may resize, once, and about the point
 * their words are pinned to; after that every open leaves the board alone.
 */
it("fits every text box on the first open, then changes nothing", async () => {
  await page.viewport(1440, 900);
  const first = await open(start);
  const before = geo(start);
  const settled = geo(first);
  // Both boxes fitted in the one open (the second used to undo the first).
  expect(settled.t1?.[2]).not.toBe(700);
  expect(settled.t2?.[3]).not.toBe(90);
  // The centred headline kept its centre.
  const mid = (g: number[] | undefined) => (g?.[0] ?? 0) + (g?.[2] ?? 0) / 2;
  expect(mid(settled.t1)).toBeCloseTo(mid(before.t1), 5);
  // Nothing else moved: shapes, fixed text, the nested frame and its picture.
  for (const id of ["f", "bg", "t3", "g", "logo"]) {
    expect(settled[id]).toEqual(before[id]);
  }
  const wrote = writes;
  const second = await open(first);
  const third = await open(second);
  expect(geo(third)).toEqual(settled);
  expect(writes).toBe(wrote);
});
