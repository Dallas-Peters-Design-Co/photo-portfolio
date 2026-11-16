import "../../index.css";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it } from "vitest";
import type { BoardItem } from "../../types";
import { BoardItemView } from "../BoardItemView";

let host: HTMLDivElement | null = null;
let root: Root | null = null;

const flush = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

const social: BoardItem = {
  body: null,
  config: { platform: "instagram-post" },
  creditName: null,
  creditUrl: null,
  fontSize: null,
  height: 500,
  id: "s",
  imageUrl: null,
  kind: "op",
  nodeType: "social",
  photoId: null,
  result: null,
  runError: null,
  runState: null,
  textStyle: null,
  thumbUrl: null,
  width: 400,
  x: 0,
  y: 0,
  z: 1,
};

const mount = async (props: {
  isSoleSelected: boolean;
  readOnly?: boolean;
}) => {
  host = document.createElement("div");
  host.style.cssText =
    "position:fixed;left:24px;top:300px;width:400px;height:500px;";
  document.body.append(host);
  root = createRoot(host);
  root.render(
    <BoardItemView
      index={0}
      isEditing={false}
      isSelected={props.isSoleSelected}
      item={social}
      onBeginEdit={() => undefined}
      onDelete={() => undefined}
      onEditBody={() => undefined}
      onPatch={() => undefined}
      onResizeStart={() => undefined}
      onSelect={() => undefined}
      scale={1}
      {...props}
    />
  );
  await flush();
  return host;
};

afterEach(() => {
  root?.unmount();
  host?.remove();
  root = null;
  host = null;
});

it("draws the mock-up alone, with no node card or settings", async () => {
  const box = await mount({ isSoleSelected: false });
  expect(box.querySelector(".social-node")).not.toBeNull();
  expect(box.querySelector(".op-node-view")).toBeNull();
  expect(box.querySelector('[aria-label="Platform"]')).toBeNull();
});

it("puts the platform picker in a bar above it when selected", async () => {
  const box = await mount({ isSoleSelected: true });
  const bar = box.querySelector(".social-toolbar");
  expect(bar?.querySelector('[aria-label="Platform"]')).not.toBeNull();
});

it("has no picker on a published board", async () => {
  const box = await mount({ isSoleSelected: true, readOnly: true });
  expect(box.querySelector(".social-toolbar")).toBeNull();
  expect(box.querySelector(".social-node")).not.toBeNull();
});
