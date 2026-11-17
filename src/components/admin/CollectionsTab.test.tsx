import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { CollectionsTab } from "./CollectionsTab";

const PIC = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>')}`;

vi.mock("../../hooks/useCollections", () => ({
  useCollections: () => ({
    collections: [{ id: "c1", itemCount: 2, name: "Moodboard" }],
    isLoading: false,
  }),
}));

vi.mock("../../services/libraryService", () => ({
  collectionsApi: {
    get: () =>
      Promise.resolve({
        id: "c1",
        items: [
          {
            alt: "Amber poster",
            id: "i1",
            kind: "image",
            title: null,
            url: PIC,
          },
          { alt: null, id: "i2", kind: "video", title: null, url: PIC },
        ],
        name: "Moodboard",
      }),
  },
}));

it("puts a collection's picture on the board, leaving its videos out", async () => {
  const onAdd = vi.fn();
  const box = document.createElement("div");
  document.body.append(box);
  const root = createRoot(box);
  await act(async () => {
    root.render(<CollectionsTab onAdd={onAdd} />);
    await Promise.resolve();
  });
  await act(() => Promise.resolve());
  const tiles = box.querySelectorAll("button[title]");
  expect(tiles).toHaveLength(1);
  (tiles[0] as HTMLButtonElement).click();
  expect(onAdd).toHaveBeenCalledWith(
    expect.objectContaining({ altText: "Amber poster", imageUrl: PIC })
  );
  act(() => root.unmount());
  box.remove();
});
