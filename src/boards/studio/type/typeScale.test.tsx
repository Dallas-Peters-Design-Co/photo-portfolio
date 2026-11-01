import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TypeScale } from "../../../../config/typeScale.js";

const save = vi.fn(async (_id: string, doc: unknown) => ({ doc }));
const kit = {
  doc: { palette: [], typefaces: [], typeScale: null, voice: "kept" },
  id: "k1",
  name: "Unruly Chain",
  resolvedDoc: {
    palette: [],
    scans: [],
    typefaces: [
      { name: "Oswald", ref: null, role: "headline", weights: [600] },
      { name: "Public Sans", ref: null, role: "body", weights: [400] },
    ],
    typeScale: null,
  },
};

vi.mock("../../brand/ActiveBrand", () => ({
  useActiveBrand: () => ({ kit, kits: [kit], setKitId: () => undefined }),
  useBrandSwatches: () => null,
}));
vi.mock("../../../hooks/useBrandKits", () => ({
  useBrandKits: () => ({ kits: [kit], refresh: async () => undefined }),
}));
vi.mock("../../../services/brandKitService", () => ({
  brandKitsApi: { save: (id: string, doc: unknown) => save(id, doc) },
}));

const { StudioPanel } = await import("../StudioPanel");

describe("Type & Spacing Scale", () => {
  let host: HTMLDivElement | null = null;
  let root: Root | null = null;
  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    save.mockClear();
  });

  const mount = (onAdd = vi.fn()) => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    act(() =>
      root?.render(
        <StudioPanel
          initialTool="type-scale"
          onAdd={onAdd}
          onClose={() => undefined}
        />
      )
    );
    return host;
  };
  const button = (el: HTMLElement, text: string) =>
    [...el.querySelectorAll("button")].find((b) =>
      b.textContent?.includes(text)
    ) as HTMLButtonElement;
  const setInput = (input: HTMLInputElement, value: string) => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };

  it("starts from a generated scale in the kit's faces and saves edits to the kit", async () => {
    const el = mount();
    const names = [
      ...el.querySelectorAll<HTMLInputElement>(".type-scale__name"),
    ].map((i) => i.value);
    expect(names).toEqual([
      "display",
      "h1",
      "h2",
      "h3",
      "h4",
      "lead",
      "body",
      "small",
      "label",
    ]);
    const [, h1Specimen] = el.querySelectorAll<HTMLElement>(
      ".type-scale__specimen"
    );
    expect(h1Specimen?.style.fontFamily).toContain("Oswald");
    expect(h1Specimen?.style.fontWeight).toBe("600");

    const size = el.querySelector<HTMLInputElement>(
      '[aria-label="h1 size in pixels"]'
    );
    act(() => setInput(size as HTMLInputElement, "72"));
    expect(
      el.querySelectorAll<HTMLElement>(".type-scale__specimen")[1]?.style
        .fontSize
    ).toBe("72px");

    await act(async () => {
      button(el, "Save to Unruly Chain").click();
      await vi.waitFor(() => expect(save).toHaveBeenCalled());
    });
    const [id, doc] = save.mock.calls[0] as [
      string,
      { typeScale: TypeScale; voice: string },
    ];
    expect(id).toBe("k1");
    expect(doc.voice).toBe("kept");
    expect(doc.typeScale.styles[1]).toMatchObject({
      name: "h1",
      size: 72,
      weight: 600,
    });
    expect(doc.typeScale.spacing).toEqual([
      4, 8, 12, 16, 24, 32, 48, 64, 96, 128,
    ]);
  });

  it("puts a specimen on the board", async () => {
    const onAdd = vi.fn();
    const el = mount(onAdd);
    await act(async () => {
      button(el, "Add to board").click();
      await vi.waitFor(() => expect(onAdd).toHaveBeenCalled());
    });
    const file = onAdd.mock.calls[0]?.[0] as File;
    expect(file.name).toBe("type-scale.png");
    const bitmap = await createImageBitmap(file);
    expect(bitmap.width).toBe(2000);
    expect(bitmap.height).toBeGreaterThan(800);
  });
});
