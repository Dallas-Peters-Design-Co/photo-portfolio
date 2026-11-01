import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EMPTY_KIT } from "../../../config/brandKit.js";
import { BLANK_ITEM } from "../../components/admin/boardEditor/placement";
import type { BoardItem } from "../../types";

const generateImage = vi.fn(async () => ({
  prompt: "p",
  url: "https://blob/made.png",
}));

vi.mock("../../services/brandKitService", () => ({
  brandKitsApi: { generateImage },
}));
vi.mock("../brand/ActiveBrand", () => ({
  useActiveBrand: () => ({
    kit: {
      id: "k1",
      name: "Bird Creek",
      resolvedDoc: {
        ...EMPTY_KIT,
        look: { id: "nope", strength: 1 },
        onBrand: ["https://blob/a.jpg"],
      },
    },
    kits: [],
    setKitId: () => undefined,
  }),
}));

const { GenerateImage } = await import("./GenerateImage");

const item = (over: Partial<BoardItem>): BoardItem =>
  ({
    ...BLANK_ITEM,
    height: 540,
    id: "x",
    kind: "drawing",
    width: 540,
    x: 0,
    y: 0,
    z: 1,
    ...over,
  }) as BoardItem;

const frame = item({
  body: "Instagram · Post · square · 1080×1080",
  id: "f",
  kind: "frame",
  z: 0,
});
const background = item({ id: "bg", z: 1 });
const headline = item({ height: 60, id: "h", kind: "text", z: 2 });

let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

describe("GenerateImage", () => {
  it("asks the brand for a picture at the frame's size and slots it over the background", async () => {
    const onChange = vi.fn();
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    act(() =>
      root?.render(
        <GenerateImage
          background={background}
          frame={frame}
          items={[frame, background, headline]}
          layers={[background, headline]}
          onChange={onChange}
        />
      )
    );
    const ask = host.querySelector("textarea") as HTMLTextAreaElement;
    act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value"
      )?.set?.call(ask, "a roof at dusk");
      ask.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const go = [...host.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === "Generate"
    );
    await act(async () => {
      go?.click();
      await vi.waitFor(() => expect(onChange).toHaveBeenCalled());
    });
    expect(generateImage).toHaveBeenCalledWith("k1", {
      ask: "a roof at dusk",
      height: 1080,
      look: "",
      matchPhotos: true,
      width: 1080,
    });
    const [next, selected] = onChange.mock.calls[0] as [BoardItem[], string];
    const picture = next.find((i) => i.id === selected);
    expect(picture).toMatchObject({
      height: 540,
      imageUrl: "https://blob/made.png",
      kind: "reference",
      width: 540,
      z: 2,
    });
    expect(next.find((i) => i.id === "h")?.z).toBe(3);
    expect(next.find((i) => i.id === "bg")?.z).toBe(1);
    expect(host.querySelectorAll(".creative-generate__made img")).toHaveLength(
      1
    );
  });
});
