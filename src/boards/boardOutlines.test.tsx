import "../index.css";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import type { BoardItem } from "../types";
import { BoardTextTools } from "./BoardTextTools";

vi.mock("./creative/textOutlines", () => ({
  outlineTextLayer: (layer: BoardItem) =>
    Promise.resolve({
      ...layer,
      body: null,
      config: { d: "M0 0L1 1", tool: "vector" },
      fontSize: null,
      kind: "drawing",
      textStyle: null,
    }),
}));

const item = (kind: "note" | "text"): BoardItem => ({
  body: "Hello",
  config: null,
  creditName: null,
  creditUrl: null,
  fontSize: 24,
  height: 40,
  id: "t",
  imageUrl: null,
  kind,
  nodeType: null,
  photoId: null,
  result: null,
  runError: null,
  runState: null,
  textStyle: null,
  thumbUrl: null,
  width: 200,
  x: 0,
  y: 0,
  z: 1,
});

const mount = async (
  kind: "note" | "text",
  onPatch: (patch: Partial<BoardItem>) => void
) => {
  const host = document.createElement("div");
  host.style.cssText =
    "position:fixed;left:20px;top:300px;width:200px;height:40px";
  host.append(document.createElement("textarea"));
  const bar = document.createElement("div");
  host.append(bar);
  document.body.append(host);
  createRoot(bar).render(
    <BoardTextTools
      anchor={{ current: host }}
      chromeScale={{ transform: "scale(1)" }}
      item={item(kind)}
      onPatch={onPatch}
    />
  );
  await vi.waitFor(() => {
    expect(host.querySelector("button")).not.toBeNull();
  });
  return [...host.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === "Outlines"
  );
};

it("a text item's bar converts it to outlines in one patch", async () => {
  const onPatch = vi.fn();
  const button = await mount("text", onPatch);
  expect(button).toBeDefined();
  button?.click();
  await vi.waitFor(() => expect(onPatch).toHaveBeenCalledOnce());
  expect(onPatch.mock.calls[0]?.[0]).toMatchObject({
    body: null,
    kind: "drawing",
  });
});

it("a note has no Outlines button", async () => {
  expect(await mount("note", () => undefined)).toBeUndefined();
});
