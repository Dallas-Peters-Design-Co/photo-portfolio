import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { mosaicTool } from "./generators/mosaic";
import { ImagePick } from "./ImagePick";

/**
 * A mosaic can be made from whatever is selected in the frame: the picker
 * offers the selection, draws it when pressed (again on each press, so it
 * follows the selection), and the mosaic leaves out the see-through parts.
 */
it("offers the frame's selection as the picture, drawn fresh each press", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let takes = 0;
  const picked: string[] = [];
  act(() =>
    root.render(
      <ImagePick
        fromFrame={{
          label: "Selection (2)",
          take: () => {
            takes += 1;
            return Promise.resolve(new Blob(["x"], { type: "image/png" }));
          },
        }}
        label="Picture"
        onPick={(url) => picked.push(url)}
      />
    )
  );
  const button = host.querySelector(
    '[aria-label="Use the frame: Selection (2)"]'
  ) as HTMLButtonElement;
  expect(button.textContent).toContain("Selection (2)");
  await act(async () => {
    button.click();
    await Promise.resolve();
  });
  await act(async () => {
    button.click();
    await Promise.resolve();
  });
  expect(takes).toBe(2);
  expect(picked).toHaveLength(2);
  expect(picked[0]?.startsWith("blob:")).toBe(true);
  act(() => root.unmount());
  host.remove();
});

it("leaves out tiles where the picture is see-through", async () => {
  const src = document.createElement("canvas");
  src.width = 40;
  src.height = 40;
  const g = src.getContext("2d") as CanvasRenderingContext2D;
  g.fillStyle = "#ff0000";
  g.fillRect(0, 0, 20, 40);
  const image = await createImageBitmap(src);
  const svg = mosaicTool.render(
    { colour: "photo", columns: 4, gap: 0, painted: "", tile: "square" },
    { height: 400, image, palette: ["#000000"], width: 400 }
  );
  // Only the left half: 2 of 4 columns, 4 rows.
  expect((svg.match(/<rect/g) ?? []).length).toBe(8);
});
