import "../../index.css";
import type { ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { EMPTY_KIT } from "../../../config/brandKit.js";
import type { BrandKit } from "../../services/brandKitService";

/**
 * The board's Brand panel: picking a brand shows its colours, logos and
 * references, remembers the choice for the board, and drops a logo onto the
 * board when it's clicked.
 */

const LIB = "3f2a1b0c-1d2e-4f50-8a9b-0c1d2e3f4a5b";

const kit: BrandKit = {
  createdAt: "2026-10-31T00:00:00.000Z",
  doc: EMPTY_KIT,
  id: "kit-1",
  inherited: [],
  name: "Bird Creek",
  parentId: null,
  parentName: null,
  resolvedDoc: {
    ...EMPTY_KIT,
    libraryCollectionId: LIB,
    logos: [
      {
        clearSpace: 0.25,
        label: "Primary",
        minWidth: 64,
        rules: "",
        url: "https://example.com/logo.svg",
      },
    ],
    onBrand: ["https://example.com/on-brand.jpg"],
    palette: [
      { name: "Forest", role: "primary", value: "#1f4d3a" },
      { name: "Lime", role: "accent", value: "#c8e86b" },
    ],
    references: [
      {
        body: "Teal only for buttons.",
        date: "2026-10-31",
        id: "r1",
        source: "Obsidian",
        title: "CTA colour",
      },
    ],
  },
  updatedAt: "2026-10-31T00:00:00.000Z",
  version: 1,
  versionCount: 1,
  versionId: "v1",
} as BrandKit;

vi.mock("../../hooks/useBrandKits", () => ({
  useBrandKits: () => ({
    error: null,
    isLoading: false,
    kits: [kit],
    refresh: vi.fn(),
  }),
}));

vi.mock("../../services/libraryService", () => ({
  collectionsApi: {
    get: () =>
      Promise.resolve({
        id: LIB,
        items: [
          {
            alt: null,
            height: null,
            id: "i1",
            kind: "image",
            title: "Crew",
            url: "https://example.com/crew.jpg",
            width: null,
          },
        ],
        name: "Bird Creek library",
      }),
  },
  imagesApi: {
    describe: () => Promise.resolve({ described: 0, left: 0 }),
    pending: () => Promise.resolve(0),
    search: () => Promise.resolve([]),
  },
}));

const { ActiveBrandProvider, useBrandSwatches } = await import(
  "../brand/ActiveBrand"
);
const { BrandDock } = await import("./BrandDock");

let host: HTMLDivElement | null = null;
let root: Root | null = null;

const flush = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(() => requestAnimationFrame(() => resolve()), 30);
  });

const render = async (ui: ReactElement): Promise<HTMLElement> => {
  host = document.createElement("div");
  // The board's own stacking context, as `.board` makes one in the app: the
  // dock's z-index then ranks inside it, and the brand menu, portalled to the
  // body, opens over the dock rather than under it.
  host.style.position = "relative";
  host.style.zIndex = "0";
  document.body.append(host);
  root = createRoot(host);
  root.render(ui);
  await flush();
  return host;
};

afterEach(() => {
  root?.unmount();
  host?.remove();
  host = null;
  root = null;
  localStorage.clear();
});

function Swatches() {
  const swatches = useBrandSwatches();
  return <output>{swatches?.map((s) => s.color).join(",") ?? "none"}</output>;
}

/** Picks a brand from the header's menu, by name, as a pointer would. */
const choose = async (el: HTMLElement, name: string) => {
  const trigger = el.querySelector(
    "button[aria-label='Brand']"
  ) as HTMLButtonElement;
  await userEvent.click(trigger);
  const option = await vi.waitFor(() => {
    const found = [...document.querySelectorAll("[role='option']")].find((o) =>
      o.textContent?.includes(name)
    );
    if (!found) {
      throw new Error("menu not open");
    }
    return found as HTMLElement;
  });
  await userEvent.click(option);
  await flush();
};

describe("BrandDock", () => {
  it("asks for a brand first, then shows its parts", async () => {
    const el = await render(
      <ActiveBrandProvider boardId="b1">
        <BrandDock onClose={vi.fn()} onInsert={vi.fn()} />
      </ActiveBrandProvider>
    );
    expect(el.textContent).toContain("Pick a brand");
    await choose(el, "Bird Creek");
    expect(el.querySelectorAll(".brand-dock__swatch")).toHaveLength(2);
    expect(el.textContent).toContain("CTA colour");
    await flush();
    expect(
      el.querySelector('img[src="https://example.com/crew.jpg"]')
    ).not.toBeNull();
  });

  it("drops a logo onto the board when clicked", async () => {
    localStorage.setItem("board-brand:b2", "kit-1");
    const onInsert = vi.fn();
    const el = await render(
      <ActiveBrandProvider boardId="b2">
        <BrandDock onClose={vi.fn()} onInsert={onInsert} />
      </ActiveBrandProvider>
    );
    (el.querySelector(".brand-dock__tile--logo") as HTMLButtonElement).click();
    expect(onInsert).toHaveBeenCalledWith({
      imageUrl: "https://example.com/logo.svg",
      thumbUrl: "https://example.com/logo.svg",
    });
  });

  it("gives the board's colour pickers the brand palette, remembered per board", async () => {
    const el = await render(
      <ActiveBrandProvider boardId="b3">
        <BrandDock onClose={vi.fn()} onInsert={vi.fn()} />
        <Swatches />
      </ActiveBrandProvider>
    );
    expect(el.querySelector("output")?.textContent).toBe("none");
    await choose(el, "Bird Creek");
    expect(el.querySelector("output")?.textContent).toBe("#1f4d3a,#c8e86b");
    expect(localStorage.getItem("board-brand:b3")).toBe("kit-1");
  });

  it("shows the kit's own images, with or without a linked library", async () => {
    localStorage.setItem("board-brand:b4", "kit-1");
    const onInsert = vi.fn();
    const el = await render(
      <ActiveBrandProvider boardId="b4">
        <BrandDock onClose={vi.fn()} onInsert={onInsert} />
      </ActiveBrandProvider>
    );
    const tile = el.querySelector('img[src="https://example.com/on-brand.jpg"]')
      ?.parentElement as HTMLButtonElement;
    tile.click();
    expect(onInsert).toHaveBeenCalledWith({
      imageUrl: "https://example.com/on-brand.jpg",
      thumbUrl: "https://example.com/on-brand.jpg",
    });
    expect(el.textContent).not.toContain("No images in this kit");
  });
});
