import "../../index.css";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import type { BoardItem } from "../../types";
import { ContextBar } from "./ContextBar";

const text: BoardItem = {
  body: "Hello",
  config: null,
  creditName: null,
  creditUrl: null,
  fontSize: 24,
  height: 40,
  id: "t",
  imageUrl: null,
  kind: "text",
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
};

it("a text layer's bar has a button that converts it to a vector shape", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const onOutline = vi.fn();
  const root = createRoot(host);
  root.render(
    <ContextBar
      frame={{ height: 400, width: 400, x: 0, y: 0 }}
      item={text}
      onDelete={() => undefined}
      onDuplicate={() => undefined}
      onOutline={onOutline}
      onPatch={() => undefined}
      onReorder={() => undefined}
      onToBoard={() => undefined}
    />
  );
  const label = '[aria-label="Convert text to a vector shape (⇧⌘O)"]';
  await vi.waitFor(() => {
    expect(host.querySelector(label)).not.toBeNull();
  });
  host.querySelector<HTMLElement>(label)?.click();
  expect(onOutline).toHaveBeenCalledOnce();
  root.unmount();
  host.remove();
});
