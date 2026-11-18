import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import {
  type BrandKitDoc,
  EMPTY_KIT,
  sanitizeKitDoc,
} from "../../../config/brandKit.js";
import {
  createConceptElement,
  styleSample,
} from "../../../config/conceptDefaults.js";
import type { ConceptStyle } from "../../../config/conceptStyle.js";
import { componentsApi } from "../../boards/creative/components/componentsApi";
import { BrandKitComponents } from "./BrandKitComponents";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const parentStyle: ConceptStyle = {
  id: "p1",
  kind: "button",
  look: { background: "#ff0000" },
  name: "Primary",
};

let saved: BrandKitDoc = EMPTY_KIT;

function SubBrand() {
  const [doc, setDoc] = useState<BrandKitDoc>(EMPTY_KIT);
  saved = doc;
  return (
    <BrandKitComponents
      doc={doc}
      effective={{
        ...doc,
        componentStyles:
          doc.componentStyles.length > 0 ? doc.componentStyles : [parentStyle],
      }}
      kitId="kit-1"
      onChange={setDoc}
    />
  );
}

it("keeps the parent's styles when a sub-brand adds its first own", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  act(() => createRoot(host).render(<SubBrand />));
  await userEvent.click(
    host.querySelector('[aria-label="Add a component style"]') as HTMLElement
  );
  const badge = await vi.waitFor(() => {
    const found = [...document.querySelectorAll('[role="option"]')].find(
      (option) => option.textContent === "Badge"
    );
    if (!found) {
      throw new Error("menu not open");
    }
    return found as HTMLElement;
  });
  await userEvent.click(badge);
  expect(saved.componentStyles.map((style) => style.id)[0]).toBe("p1");
  expect(saved.componentStyles.map((style) => style.kind)).toEqual([
    "button",
    "badge",
  ]);
  // The new style opens, ready to style; the parent's stays folded.
  expect(
    host.querySelector('[aria-label="Fold Badge Primary"]')
  ).not.toBeNull();
  expect(
    host.querySelector('[aria-label="Open Button Primary"]')
  ).not.toBeNull();
  host.remove();
});

function OneCard({ kitId = "kit-1" }: { kitId?: string } = {}) {
  const [doc, setDoc] = useState<BrandKitDoc>({
    ...EMPTY_KIT,
    componentStyles: [{ id: "c1", kind: "card", look: {}, name: "Card" }],
  });
  saved = doc;
  return (
    <BrandKitComponents
      doc={doc}
      effective={doc}
      kitId={kitId}
      onChange={setDoc}
    />
  );
}

it("keeps the icon picked for a style", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  act(() => createRoot(host).render(<OneCard />));
  // Styles start folded; open this one.
  expect(host.querySelector('[aria-label="Card icon"]')).toBeNull();
  await userEvent.click(
    host.querySelector('[aria-label="Open Card Card"]') as HTMLElement
  );
  await userEvent.click(
    host.querySelector('[aria-label="Card icon"]') as HTMLElement
  );
  await userEvent.click(
    host.querySelector('[role="option"][title="Favourite"]') as HTMLElement
  );
  expect(saved.componentStyles[0]?.look.iconName).toBe("FavouriteIcon");
  expect(saved.componentStyles[0]?.look.iconSvg).toBeTruthy();
  expect(host.querySelector('[aria-label="Card icon"]')?.textContent).toContain(
    "Favourite"
  );
  host.remove();
});

it("edits the panel's close button in the brand kit", async () => {
  const panel = createConceptElement("panel");
  function PanelKit() {
    const [doc, setDoc] = useState<BrandKitDoc>({
      ...EMPTY_KIT,
      componentStyles: [
        {
          id: "panel-test",
          kind: "panel",
          look: { contents: panel.slots },
          name: "Primary",
        },
      ],
    });
    saved = doc;
    return (
      <BrandKitComponents
        doc={doc}
        effective={doc}
        kitId="kit-1"
        onChange={setDoc}
      />
    );
  }
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(() => root.render(<PanelKit />));
  await userEvent.click(
    host.querySelector('[aria-label="Open Panel Primary"]') as HTMLElement
  );
  const button = [
    ...host.querySelectorAll<HTMLElement>('[aria-label="button"]'),
  ].find((section) => section.querySelector('[aria-label="Padding X"]'));
  const padding = button?.querySelector<HTMLInputElement>(
    '[aria-label="Padding X"]'
  );
  expect(padding).toBeDefined();
  await userEvent.clear(padding as HTMLInputElement);
  await userEvent.type(padding as HTMLInputElement, "20");
  expect(
    saved.componentStyles[0]?.look.contents?.hide?.elements[0]?.paddingX
  ).toBe(20);
  await act(() => root.unmount());
  host.remove();
});

const kitStyles: ConceptStyle[] = [
  { id: "s1", kind: "button", look: {}, name: "Primary" },
  { id: "s2", kind: "badge", look: {}, name: "Warning" },
  { id: "s3", kind: "card", look: {}, name: "Plain" },
];

function Kit() {
  const [doc, setDoc] = useState<BrandKitDoc>({
    ...EMPTY_KIT,
    componentStyles: kitStyles,
  });
  saved = doc;
  return (
    <BrandKitComponents
      doc={doc}
      effective={doc}
      kitId="kit-1"
      onChange={setDoc}
    />
  );
}

it("reorders a kit's styles from a style's handle, and keeps remove at the row's end", async () => {
  const host = document.createElement("div");
  host.style.width = "900px";
  document.body.append(host);
  act(() => createRoot(host).render(<Kit />));

  const row = host.querySelector(".brand-kit-components__head") as HTMLElement;
  const remove = row.querySelector(
    '[aria-label="Remove Primary"]'
  ) as HTMLElement;
  // One line, the remove button at its far right.
  expect(remove.getBoundingClientRect().top).toBeLessThan(
    row.getBoundingClientRect().top + 20
  );
  expect(
    row.getBoundingClientRect().right - remove.getBoundingClientRect().right
  ).toBeLessThan(4);

  const handle = host.querySelector(
    '[aria-label^="Move Button Primary"]'
  ) as HTMLElement;
  handle.focus();
  await userEvent.keyboard("{ArrowDown}");
  expect(saved.componentStyles.map((style) => style.id)).toEqual([
    "s2",
    "s1",
    "s3",
  ]);
});

it("uses the kit button and saves the chosen tag style in a table slot", async () => {
  const table: ConceptStyle = {
    id: "table-slots",
    kind: "table",
    look: {},
    name: "Records",
  };
  const tag: ConceptStyle = {
    id: "tag-blue",
    kind: "tag",
    look: { background: "#1111ff" },
    name: "Blue",
  };
  const green: ConceptStyle = {
    ...tag,
    id: "tag-green",
    look: { background: "#119922" },
    name: "Green",
  };
  function TableKit() {
    const [doc, setDoc] = useState<BrandKitDoc>({
      ...EMPTY_KIT,
      componentStyles: [table, parentStyle, tag, green],
    });
    saved = doc;
    return (
      <BrandKitComponents
        doc={doc}
        effective={doc}
        kitId="kit-1"
        onChange={setDoc}
      />
    );
  }
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    act(() => root.render(<TableKit />));
    await userEvent.click(
      host.querySelector('[aria-label="Open Table Records"]') as HTMLElement
    );
    const fill = (selector: string) =>
      getComputedStyle(host.querySelector(selector) as HTMLElement)
        .backgroundColor;
    expect(fill(".concept-table__button")).toBe("rgb(255, 0, 0)");
    expect(fill(".concept-table__chip")).toBe("rgb(17, 17, 255)");
    await userEvent.click(
      host.querySelector('[aria-label="Column 3 kit style"]') as HTMLElement
    );
    const option = [
      ...document.querySelectorAll<HTMLElement>('[role="option"]'),
    ].find((item) => item.textContent === "Tag / Green");
    if (!option) {
      throw new Error("Missing Green tag option");
    }
    await userEvent.click(option);
    expect(fill(".concept-table__chip")).toBe("rgb(17, 153, 34)");
    const kit = sanitizeKitDoc(saved);
    const stored = kit.componentStyles.find((style) => style.id === table.id);
    if (!stored) {
      throw new Error("Missing saved table style");
    }
    const sample = styleSample(stored, kit);
    expect(sample.table?.columns[2]).toMatchObject({
      look: { background: "#119922" },
      styleId: "tag-green",
    });
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});

it("saves a canvas component in a code card's starting slot", async () => {
  const list = vi.spyOn(componentsApi, "list").mockResolvedValue([
    {
      height: 24,
      id: "canvas-mark",
      kitId: "canvas-slot-kit",
      layers: [
        {
          body: "Kit mark",
          config: null,
          fontSize: 12,
          height: 24,
          imageUrl: null,
          kind: "text",
          lid: "caption",
          thumbUrl: null,
          width: 60,
          x: 0,
          y: 0,
        },
      ],
      name: "Canvas mark",
      placement: {},
      props: [],
      updatedAt: "",
      width: 60,
    },
  ]);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(() => root.render(<OneCard kitId="canvas-slot-kit" />));
    const open = host.querySelector<HTMLButtonElement>(
      '[aria-label="Open Card Card"]'
    );
    if (open) {
      await userEvent.click(open);
    }
    const add = host.querySelector<HTMLElement>(
      '[aria-label="Add to in the footer"]'
    );
    if (!add) {
      throw new Error("Missing card footer picker");
    }
    await vi.waitFor(() =>
      expect(list).toHaveBeenCalledWith("canvas-slot-kit")
    );
    await userEvent.click(add);
    const option = await vi.waitFor(() => {
      const match = [
        ...document.querySelectorAll<HTMLElement>('[role="option"]'),
      ].find((item) => item.textContent === "Canvas mark");
      if (!match) {
        throw new Error("Missing kit canvas component");
      }
      return match;
    });
    await userEvent.click(option);
    const [style] = sanitizeKitDoc(saved).componentStyles;
    expect(
      style?.look.contents?.footer?.elements.at(-1)?.canvasComponent?.id
    ).toBe("canvas-mark");
  } finally {
    await act(() => root.unmount());
    host.remove();
    list.mockRestore();
  }
});
