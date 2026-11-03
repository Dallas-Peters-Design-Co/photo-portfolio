import "../../../index.css";
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import type { BoardItem } from "../../../types";
import type { BrandComponent, Draft } from "./componentModel";
import { linkOf } from "./componentModel";

/**
 * Components end to end in the real frame editor: make one from two layers,
 * drop a copy into another frame, override its text, update the component
 * from the first copy, and see the second follow but keep its own words.
 */

let saved: BrandComponent[] = [];
let version = 0;
vi.mock("./componentsApi", () => ({
  componentsApi: {
    list: () => Promise.resolve(saved),
    remove: () => Promise.resolve(),
    save: (d: Draft & { id?: string }) => {
      version += 1;
      const out: BrandComponent = {
        ...d,
        id: d.id ?? "0b9f3c1e-6b8a-4e3c-9f55-2c1d4e5f6a7b",
        kitId: "kit",
        updatedAt: `v${version}`,
      };
      saved = [out];
      return Promise.resolve(out);
    },
  },
}));
vi.mock("../../brand/ActiveBrand", async (load) => ({
  ...(await load<typeof import("../../brand/ActiveBrand")>()),
  useActiveBrand: () => ({
    kit: { id: "kit", name: "RoleModel", resolvedDoc: null },
    kits: [],
    setKitId: () => undefined,
  }),
}));
vi.mock("../../../components/admin/ConfirmProvider", () => ({
  useConfirm: () => ({
    confirm: () => Promise.resolve(true),
    prompt: () => Promise.resolve("Vision tag"),
  }),
}));

const { CreativeEditor } = await import("../CreativeEditor");

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
const frameA: BoardItem = {
  ...base,
  body: "A",
  height: 540,
  id: "fa",
  kind: "frame",
  width: 360,
  x: 0,
  y: 0,
  z: 0,
};
const frameB: BoardItem = { ...frameA, body: "B", id: "fb", x: 1000 };
const tagText: BoardItem = {
  ...base,
  body: "Vision",
  fontSize: 20,
  height: 30,
  id: "t",
  kind: "text",
  textStyle: {
    align: "center",
    color: "#86d4e9",
    family: null,
    italic: null,
    letterSpacing: null,
    lineHeight: null,
    transform: null,
    weight: 700,
  },
  width: 100,
  x: 250,
  y: 20,
  z: 2,
};
const tagBox: BoardItem = {
  ...base,
  config: { fill: "#04242b", stroke: "#000000", strokeWidth: 0, tool: "rect" },
  height: 40,
  id: "b",
  kind: "drawing",
  width: 110,
  x: 245,
  y: 15,
  z: 1,
};

let latest: BoardItem[] = [];
let openFrame: (id: string) => void = () => undefined;
let setAll: (f: (was: BoardItem[]) => BoardItem[]) => void = () => undefined;

function Harness() {
  const [items, setItems] = useState([frameA, frameB, tagBox, tagText]);
  const [frameId, setFrameId] = useState("fa");
  latest = items;
  openFrame = setFrameId;
  setAll = setItems;
  return (
    <CreativeEditor
      frameId={frameId}
      items={items}
      key={frameId}
      onChange={setItems}
      onClose={() => undefined}
    />
  );
}

const button = (text: string) => {
  const found = [...document.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").includes(text)
  );
  if (!found) {
    throw new Error(`no button ${text}`);
  }
  return found;
};
const settle = () =>
  act(async () => await new Promise((r) => setTimeout(r, 30)));

it("makes a component, places a copy elsewhere, and keeps overrides through an update", async () => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root?.render(<Harness />));
  await settle();

  // Select both layers from the list, then make the component.
  const rows = [
    ...document.querySelectorAll<HTMLElement>(".creative__layer-row"),
  ];
  act(() => rows[0]?.click());
  act(() =>
    rows[1]?.dispatchEvent(
      new MouseEvent("click", { bubbles: true, shiftKey: true })
    )
  );
  act(() => button("Make component").click());
  await settle();
  const first = latest.filter((i) => linkOf(i));
  expect(first).toHaveLength(2);
  expect(first.find((i) => i.kind === "text")).toMatchObject({ x: 250, y: 20 });

  // Into frame B: same place in the frame.
  act(() => openFrame("fb"));
  await settle();
  act(() => button("Vision tag").click());
  const inB = () => latest.filter((i) => linkOf(i) && i.x >= 1000);
  expect(inB().find((i) => i.kind === "text")).toMatchObject({
    x: 1250,
    y: 20,
  });

  // B says something else.
  const bText = inB().find((i) => i.kind === "text") as BoardItem;
  act(() =>
    setAll((was) =>
      was.map((i) => (i.id === bText.id ? { ...i, body: "Mission" } : i))
    )
  );

  // Back in A: the box goes blue, then the component is updated from A.
  act(() => openFrame("fa"));
  await settle();
  act(() =>
    setAll((was) =>
      was.map((i) =>
        i.kind === "drawing" && linkOf(i) && i.x < 1000
          ? { ...i, config: { ...i.config, fill: "#2a84f8" } }
          : i
      )
    )
  );
  const aRows = [
    ...document.querySelectorAll<HTMLElement>(".creative__layer-row"),
  ];
  act(() => aRows[0]?.click());
  act(() => button("Update all").click());
  await settle();

  expect(inB().find((i) => i.kind === "drawing")?.config?.fill).toBe("#2a84f8");
  expect(inB().find((i) => i.kind === "text")?.body).toBe("Mission");
  // A copy layer selected shows what can be done with the copy.
  expect(document.querySelector(".components__copy")?.textContent).toContain(
    "Vision tag"
  );

  // On the artboard a copy is one thing: a press picks all of it and a drag
  // moves it whole. A double-click goes inside to pick a single layer.
  const inA = () => latest.filter((i) => linkOf(i) && i.x < 1000);
  act(() => {
    document
      .querySelector(".creative__stage")
      ?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  });
  const textId = inA().find((i) => i.kind === "text")?.id ?? "";
  const layer = document.querySelector(
    `[data-layer-id="${textId}"]`
  ) as Element;
  const board = document.querySelector(".creative__board") as Element;
  const r = layer.getBoundingClientRect();
  const from = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  const scale = board.getBoundingClientRect().width / 360;
  const to = { x: from.x - 100 * scale, y: from.y + 50 * scale };
  const before = inA().map((i) => [i.x, i.y]);
  const pointer = (
    type: string,
    target: Element,
    p: { x: number; y: number }
  ) =>
    act(() => {
      target.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          button: 0,
          buttons: type === "pointerup" ? 0 : 1,
          clientX: p.x,
          clientY: p.y,
          metaKey: type === "pointermove",
          pointerId: 1,
          pointerType: "mouse",
        })
      );
    });
  pointer("pointerdown", layer, from);
  pointer("pointermove", board, to);
  pointer("pointerup", board, to);
  const after = inA().map((i) => [i.x, i.y]);
  expect(after).toEqual(before.map(([x = 0, y = 0]) => [x - 100, y + 50]));
  expect(document.querySelectorAll(".creative__layer--selected")).toHaveLength(
    2
  );

  act(() => layer.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })));
  expect(document.querySelectorAll(".creative__layer--selected")).toHaveLength(
    1
  );
});
