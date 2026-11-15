import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { BLANK_ITEM } from "../../components/admin/boardEditor/placement";
import type { BoardItem } from "../../types";
import { toolById } from "./registry";
import { type BoardTools, useBoardTools } from "./useBoardTools";

let root: Root | null = null;
let host: HTMLDivElement | null = null;
let tools: BoardTools | null = null;
const onChange = vi.fn();

afterEach(() => {
  root?.unmount();
  host?.remove();
  tools = null;
});

const image: BoardItem = {
  ...BLANK_ITEM,
  height: 200,
  id: "image",
  imageUrl: "https://example.test/image.png",
  kind: "reference",
  width: 300,
  x: 0,
  y: 0,
  z: 1,
};

function Harness({ onCrop }: { onCrop: (item: BoardItem) => void }) {
  tools = useBoardTools({
    boardId: "board",
    items: [image],
    onChange,
    onCrop,
  });
  return null;
}

it("opens the crop editor before executing or changing the image", async () => {
  const onCrop = vi.fn();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  root.render(<Harness onCrop={onCrop} />);
  await vi.waitFor(() => expect(tools).toBeTruthy());
  const crop = toolById("crop");
  if (!(crop && tools)) {
    throw new Error("Crop must be ready");
  }
  tools.run(image, crop);
  expect(onCrop).toHaveBeenCalledExactlyOnceWith(image);
  expect(tools.isRunning(image.id)).toBe(false);
  expect(onChange).not.toHaveBeenCalled();
});
