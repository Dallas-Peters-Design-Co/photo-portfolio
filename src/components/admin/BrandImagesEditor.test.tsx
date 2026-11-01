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

const list = vi.fn(async () => ({
  hasMore: false,
  items: [
    {
      contentType: null,
      endpoint: "fal-ai/flux",
      id: "f1",
      previewUrl: "https://fal/f1-thumb.jpg",
      prompt: "a field",
      url: "https://fal/f1.png",
    },
    {
      contentType: "video/mp4",
      endpoint: "fal-ai/veo",
      id: "f2",
      previewUrl: "",
      prompt: null,
      url: "https://fal/f2.mp4",
    },
  ],
}));

vi.mock("../../services/portfolioService", async (orig) => ({
  ...(await orig<object>()),
  falLibraryApi: { adopt: vi.fn(), list },
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

const tab = (label: string) =>
  [...(host?.querySelectorAll(".brand-images__tabs button") ?? [])].find(
    (b) => b.textContent === label
  ) as HTMLButtonElement | undefined;

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

  it("shows the fal library every time the tab opens", async () => {
    render(EMPTY_KIT, vi.fn());
    act(() => buttons("Add from")[0]?.click());
    const openFal = async () => {
      await act(async () => {
        tab("fal.ai")?.click();
        await new Promise((r) => setTimeout(r, 0));
      });
    };
    await openFal();
    expect(buttons("Add this image")).toHaveLength(1);
    act(() => tab("Pinterest")?.click());
    await openFal();
    expect(buttons("Add this image")).toHaveLength(1);
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
