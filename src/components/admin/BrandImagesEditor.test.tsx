import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type BrandKitDoc, EMPTY_KIT } from "../../../config/brandKit.js";

vi.mock("../../hooks/usePhotos", () => ({
  usePhotos: () => ({
    isLoading: false,
    photos: [
      {
        id: "p1",
        originalUrl: "https://blob/p1-full.jpg",
        url: "https://blob/p1.jpg",
      },
      { id: "p2", originalUrl: null, url: "https://blob/p2.jpg" },
    ],
  }),
}));

const { BrandImagesEditor } = await import("./BrandImagesEditor");

let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

const render = (doc: BrandKitDoc, onChange: (d: BrandKitDoc) => void) => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root?.render(<BrandImagesEditor doc={doc} onChange={onChange} />));
};

const buttons = (text: string) =>
  [...(host?.querySelectorAll("button") ?? [])].filter((b) =>
    `${b.textContent ?? ""} ${b.getAttribute("aria-label") ?? ""}`.includes(
      text
    )
  );

describe("BrandImagesEditor", () => {
  it("adds an on-brand image from the photo library", async () => {
    const onChange = vi.fn();
    render(EMPTY_KIT, onChange);
    act(() => buttons("Add from")[0]?.click());
    await act(async () => {
      buttons("Add this image")[0]?.click();
      await Promise.resolve();
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ onBrand: ["https://blob/p1-full.jpg"] })
    );
  });

  it("removes an image", () => {
    const onChange = vi.fn();
    render({ ...EMPTY_KIT, offBrand: ["https://blob/x.jpg"] }, onChange);
    act(() => buttons("Remove image")[0]?.click());
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ offBrand: [] })
    );
  });
});
