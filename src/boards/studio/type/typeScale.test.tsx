import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TypeScale } from "../../../../config/typeScale.js";
import type { StudioComposition } from "../composition";

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
  brandKitsApi: {
    fontshareFonts: async () => [],
    googleFonts: async () => [
      {
        category: "serif",
        family: "Fraunces",
        italic: true,
        rank: 1,
        variable: true,
        weights: [400, 700, 900],
      },
    ],
    save: (id: string, doc: unknown) => save(id, doc),
  },
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
          onAdd={() => undefined}
          onAddComposition={onAdd}
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

  it("sets the headline in a Google font picked here, and saves it to the kit", async () => {
    const el = mount();
    const picker = el.querySelector<HTMLButtonElement>(
      '[aria-label^="Headline font"]'
    );
    expect(picker?.textContent).toContain("Oswald");
    act(() => picker?.click());
    await act(async () => {
      await vi.waitFor(() => expect(button(el, "Fraunces")).toBeTruthy());
    });
    act(() => button(el, "Fraunces").click());

    const [, h1Specimen] = el.querySelectorAll<HTMLElement>(
      ".type-scale__specimen"
    );
    expect(h1Specimen?.style.fontFamily).toContain("Fraunces");
    // The body keeps the kit's face.
    const bodyPicker = el.querySelector('[aria-label^="Body font"]');
    expect(bodyPicker?.textContent).toContain("Public Sans");

    await act(async () => {
      button(el, "Save to Unruly Chain").click();
      await vi.waitFor(() => expect(save).toHaveBeenCalled());
    });
    const [, doc] = save.mock.calls[0] as [
      string,
      { typefaces: { name: string; ref: string | null; role: string }[] },
    ];
    expect(doc.typefaces[0]).toMatchObject({
      name: "Fraunces",
      ref: "g:Fraunces",
      role: "headline",
    });
    // Nothing the kit had is dropped.
    expect(doc.typefaces.map((f) => f.name)).toEqual([
      "Fraunces",
      "Oswald",
      "Public Sans",
    ]);
  });

  it("inserts editable text with the picked font and scale settings", async () => {
    const onAdd = vi.fn();
    const el = mount(onAdd);
    act(() =>
      el
        .querySelector<HTMLButtonElement>('[aria-label^="Headline font"]')
        ?.click()
    );
    await act(async () => {
      await vi.waitFor(() => expect(button(el, "Fraunces")).toBeTruthy());
    });
    act(() => button(el, "Fraunces").click());
    const size = el.querySelector<HTMLInputElement>(
      '[aria-label="h1 size in pixels"]'
    );
    act(() => setInput(size as HTMLInputElement, "72"));
    await act(async () => {
      button(el, "Add editable frame").click();
      await vi.waitFor(() => expect(onAdd).toHaveBeenCalled());
    });
    const composition = onAdd.mock.calls[0]?.[0] as StudioComposition;
    expect(composition.title).toBe("Unruly Chain type scale");
    expect(composition.items.every((item) => item.imageUrl === null)).toBe(
      true
    );
    expect(
      composition.items.filter((item) => item.kind === "text")
    ).toHaveLength(28);
    expect(
      composition.items.find((item) => item.fontSize === 72)
    ).toMatchObject({
      body: "The quick brown fox",
      kind: "text",
      textStyle: { family: "g:Fraunces", weight: 600 },
    });
  });
});
