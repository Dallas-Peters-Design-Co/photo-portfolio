import "../../../index.css";
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import type { BoardItem } from "../../../types";
import type { BrandComponent, Draft } from "../../components/model";
import { instanceOf } from "../../components/model";

/**
 * Components end to end in the real frame editor, the way Figma does them:
 * make one from two layers (they become one instance), open it, expose the
 * label's text and the box's colour, place it in another frame, and set those
 * there with an input and a colour picker. The layers inside an instance
 * aren't reachable; the instance moves as one thing.
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
        props: d.props,
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

function Harness() {
  const [items, setItems] = useState([frameA, frameB, tagBox, tagText]);
  const [frameId, setFrameId] = useState("fa");
  latest = items;
  openFrame = setFrameId;
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
    (b.textContent ?? "").trim().includes(text)
  );
  if (!found) {
    throw new Error(`no button ${text}`);
  }
  return found;
};
const expose = (text: string) =>
  [
    ...document.querySelectorAll<HTMLElement>(".components__expose button"),
  ].find((b) => (b.textContent ?? "").trim() === text) as HTMLElement;
const settle = () =>
  act(async () => await new Promise((r) => setTimeout(r, 30)));
const rows = () => [
  ...document.querySelectorAll<HTMLElement>(".creative__layer-row"),
];
const instances = () => latest.filter((i) => i.kind === "component");

it("makes, exposes, places and sets a component like Figma", async () => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root?.render(<Harness />));
  await settle();

  // Two layers become one instance where they were.
  act(() => rows()[0]?.click());
  act(() =>
    rows()[1]?.dispatchEvent(
      new MouseEvent("click", { bubbles: true, shiftKey: true })
    )
  );
  act(() => button("Make component").click());
  await settle();
  expect(latest.filter((i) => i.id === "t" || i.id === "b")).toHaveLength(0);
  expect(instances()).toHaveLength(1);
  expect(instances()[0]).toMatchObject({
    height: 40,
    width: 110,
    x: 245,
    y: 15,
  });
  expect(rows()).toHaveLength(1);

  // Open it, expose the label's text and the box's colour, done.
  act(() => button("Edit component").click());
  await settle();
  const open = () => rows();
  expect(open()).toHaveLength(2);
  const textRow = open().find((r) => r.textContent?.includes("Vision"));
  act(() => textRow?.click());
  act(() => expose("Text").click());
  const boxRow = open().find((r) => r.textContent?.includes("Rectangle"));
  act(() => boxRow?.click());
  act(() => expose("Fill").click());
  act(() =>
    (document.querySelector(".components__done") as HTMLElement).click()
  );
  await settle();
  expect(saved[0]?.props.map((p) => [p.name, p.type])).toEqual([
    ["Text", "text"],
    ["Fill", "color"],
  ]);
  expect(instances()).toHaveLength(1);

  // Frame B: place it, set its text with the input.
  act(() => openFrame("fb"));
  await settle();
  act(() => button("Vision tag").click());
  const inB = () => instances().find((i) => i.x >= 1000) as BoardItem;
  expect(inB()).toMatchObject({ x: 1245, y: 15 });
  const input = document.querySelector(
    ".components__text"
  ) as HTMLTextAreaElement;
  expect(input.value).toBe("Vision");
  const set = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value"
  )?.set;
  act(() => {
    set?.call(input, "Mission");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const props = instanceOf(inB())?.props ?? {};
  expect(Object.values(props)).toEqual(["Mission"]);
  // Drawn from the component with that value; A's still says Vision.
  const drawn = document.querySelector(
    `[data-layer-id="${inB().id}"] textarea`
  ) as HTMLTextAreaElement;
  expect(drawn.value).toBe("Mission");
  // The colour is a picker.
  expect(document.querySelector(".components__prop--color")).not.toBeNull();
  // One layer in the list: the instance, nothing inside it.
  expect(rows()).toHaveLength(1);
});
