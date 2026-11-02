import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BLANK_ITEM } from "../../components/admin/boardEditor/placement";
import type { BoardItem } from "../../types";
import {
  BoardImagesContext,
  boardImages,
  rememberMade,
  useImageShelf,
} from "./imageShelf";

const clear = () => localStorage.removeItem("studio:made-images");
beforeEach(clear);
afterEach(clear);

describe("imageShelf", () => {
  it("lists what was made first, then the board's pictures, once each", () => {
    const items = [
      { ...BLANK_ITEM, id: "a", imageUrl: "https://b/a.png" },
      {
        ...BLANK_ITEM,
        id: "n",
        result: {
          url: "https://b/n.png",
          variations: [{ url: "https://b/n.png" }],
        },
      },
      { ...BLANK_ITEM, id: "v", imageUrl: "https://b/clip.mp4" },
    ] as unknown as BoardItem[];
    const board = boardImages(items);
    expect(board).toContain("https://b/a.png");
    expect(board).toContain("https://b/n.png");

    rememberMade("https://b/made.png");
    rememberMade("https://b/a.png");
    let shelf: string[] = [];
    function Probe() {
      shelf = useImageShelf();
      return null;
    }
    const host = document.createElement("div");
    const root = createRoot(host);
    act(() =>
      root.render(
        <BoardImagesContext.Provider value={board}>
          <Probe />
        </BoardImagesContext.Provider>
      )
    );
    expect(shelf).toEqual([
      "https://b/a.png",
      "https://b/made.png",
      "https://b/n.png",
    ]);
    act(() => rememberMade("https://b/new.png"));
    expect(shelf[0]).toBe("https://b/new.png");
    act(() => root.unmount());
  });
});
