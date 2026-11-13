import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import type { BoardItem } from "../types";
import { AutoplayToggle } from "./AutoplayToggle";

/**
 * When the play/pause control shows. Missing on a board of Clip nodes, a
 * paused board had no way to set its clips going again.
 */

let host: HTMLDivElement | null = null;
let root: Root | null = null;

const render = async (ui: ReactElement): Promise<HTMLElement> => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(ui);
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });
  return host;
};

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  host = null;
  root = null;
});

const item = (over: Partial<BoardItem>): BoardItem =>
  ({
    h: 1,
    id: "a",
    kind: "reference",
    w: 1,
    x: 0,
    y: 0,
    z: 1,
    ...over,
  }) as BoardItem;

describe("AutoplayToggle", () => {
  it("shows for a Clip node, which keeps its file in config", async () => {
    const el = await render(
      <AutoplayToggle
        items={[
          item({
            config: { clipUrl: "https://example.com/boards/clips/a.mov" },
            kind: "op",
            nodeType: "clip",
          } as Partial<BoardItem>),
        ]}
      />
    );
    expect(el.querySelector("button")).not.toBeNull();
  });

  it("shows for a pinned clip", async () => {
    const el = await render(
      <AutoplayToggle
        items={[item({ imageUrl: "https://example.com/a.mp4" })]}
      />
    );
    expect(el.querySelector("button")).not.toBeNull();
  });

  it("stays away from a board of pictures", async () => {
    const el = await render(
      <AutoplayToggle
        items={[item({ imageUrl: "https://example.com/a.png" })]}
      />
    );
    expect(el.querySelector("button")).toBeNull();
  });
});
