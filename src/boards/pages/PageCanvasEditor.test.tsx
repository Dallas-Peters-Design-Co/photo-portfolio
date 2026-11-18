import "../../index.css";
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { EMPTY_KIT } from "../../../config/brandKit.js";
import {
  createConcept,
  createConceptElement,
} from "../../../config/conceptDefaults.js";
import { lookOf } from "../../../config/conceptStyle.js";
import type { PageDesign } from "../../../config/pageDesign.js";
import { BLANK_ITEM } from "../../components/admin/boardEditor/placement";
import type { BoardItem } from "../../types";
import { componentsApi } from "../creative/components/componentsApi";
import { PageCanvasEditor } from "./PageCanvasEditor";
import { PageDesignView } from "./PageDesignView";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const kit = {
  id: "12345678-1234-1234-1234-123456789012",
  name: "Pretext",
  resolvedDoc: {
    ...EMPTY_KIT,
    componentStyles: [
      {
        id: "primary",
        kind: "button" as const,
        look: lookOf(createConceptElement("button")),
        name: "Primary",
      },
    ],
  },
};
vi.mock("../brand/ActiveBrand", () => ({
  useActiveBrand: () => ({ kit, kits: [kit] }),
}));
const changed = vi.fn();
const closed = vi.fn();
let latest: PageDesign | null = null;
const frame: BoardItem = {
  ...BLANK_ITEM,
  body: "Results & findings",
  height: 450,
  id: "frame",
  kind: "frame",
  width: 720,
  x: 0,
  y: 0,
  z: 0,
};
function Harness({ initial }: { initial?: PageDesign }) {
  const [item, setItem] = useState({
    ...frame,
    config: initial ? { pageDesign: initial } : null,
  });
  return (
    <PageCanvasEditor
      frame={item}
      onChange={(next) => {
        latest = next;
        changed(next);
        setItem({ ...item, config: { pageDesign: next } });
      }}
      onClose={closed}
    />
  );
}
let host: HTMLDivElement;
let root: Root;
const mount = async (initial?: PageDesign) => {
  changed.mockClear();
  closed.mockClear();
  latest = null;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(() => root.render(<Harness initial={initial} />));
};
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

it("inserts a linked brand component and commits a drag only on release", async () => {
  await page.viewport(1440, 900);
  await mount();
  const insert = host.querySelector<HTMLButtonElement>(".page-builder__insert");
  await act(() => insert?.click());
  expect(latest?.concept.elements[0]?.styleId).toBe("primary");
  const id = latest?.concept.elements[0]?.id ?? "";
  const target = host.querySelector<HTMLButtonElement>(".page-builder__move");
  const sheet = host.querySelector<HTMLElement>(".page-design__sheet");
  const scale = (sheet?.getBoundingClientRect().width ?? 1440) / 1440;
  vi.spyOn(HTMLElement.prototype, "setPointerCapture").mockImplementation(
    () => undefined
  );
  changed.mockClear();
  await act(() =>
    target?.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        clientX: 100,
        clientY: 100,
        pointerId: 1,
      })
    )
  );
  await act(() =>
    target?.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        clientX: 100 + 80 * scale,
        clientY: 100 + 40 * scale,
        pointerId: 1,
      })
    )
  );
  expect(changed).not.toHaveBeenCalled();
  await act(() =>
    target?.dispatchEvent(
      new PointerEvent("pointerup", { bubbles: true, pointerId: 1 })
    )
  );
  expect(changed).toHaveBeenCalledTimes(1);
  expect(latest?.boxes[id]).toMatchObject({ x: 104, y: 64 });
  await act(() =>
    target?.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        key: "ArrowRight",
        shiftKey: true,
      })
    )
  );
  expect(latest?.boxes[id]?.x).toBe(114);
  await userEvent.fill(
    host.querySelector('[aria-label="Component text"]') as HTMLTextAreaElement,
    "Continue"
  );
  expect(latest?.concept.elements[0]).toMatchObject({
    styleId: "primary",
    text: "Continue",
  });
});

it("inserts a canvas component beside the page's other elements", async () => {
  vi.spyOn(componentsApi, "list").mockResolvedValue([
    {
      height: 100,
      id: "page-component",
      kitId: kit.id,
      layers: [
        {
          body: "Canvas title",
          config: null,
          fontSize: 24,
          height: 80,
          imageUrl: null,
          kind: "text",
          lid: "title",
          thumbUrl: null,
          width: 300,
          x: 0,
          y: 0,
        },
      ],
      name: "Canvas header",
      placement: {},
      props: [],
      updatedAt: "",
      width: 400,
    },
  ]);
  await mount();
  const choice = await vi.waitFor(() => {
    const button = [...host.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Canvas header")
    );
    if (!button) {
      throw new Error("Canvas component missing");
    }
    return button;
  });
  await act(() => choice.click());
  expect(latest?.concept.elements[0]?.canvasComponent?.layers[0]?.body).toBe(
    "Canvas title"
  );
  expect(host.textContent).toContain("Canvas title");
});

it("keeps keyboard focus in the editor and lets an added state be removed", async () => {
  await mount();
  const dialog = host.querySelector<HTMLElement>('[role="dialog"]');
  const done = [...host.querySelectorAll("button")].find((button) =>
    button.textContent?.includes("Done")
  );
  expect(dialog?.hasAttribute("data-frame-editor")).toBe(true);
  expect(document.activeElement).toBe(done);
  const add = [...host.querySelectorAll("button")].find((button) =>
    button.textContent?.includes("Add state")
  );
  await act(() => add?.click());
  expect(latest?.concept.steps).toHaveLength(1);
  const remove = [...host.querySelectorAll("button")].find((button) =>
    button.textContent?.includes("Remove state")
  );
  await act(() => remove?.click());
  expect(latest?.concept.steps ?? []).toHaveLength(0);
  const focusable = [
    ...(dialog?.querySelectorAll<HTMLElement>(
      "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex='0']"
    ) ?? []),
  ];
  const last = focusable.at(-1);
  last?.focus();
  await act(() =>
    last?.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "Tab",
      })
    )
  );
  expect(document.activeElement).toBe(focusable[0]);
  await act(() =>
    dialog?.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "Escape" })
    )
  );
  expect(closed).toHaveBeenCalledOnce();
});

const sample = (): PageDesign => {
  const concept = createConcept();
  const navbar = createConceptElement("navbar");
  const heading = {
    ...createConceptElement("text"),
    fontSize: 32,
    text: "Results & findings",
  };
  const card = {
    ...createConceptElement("card"),
    text: "Evidence ready to review\nYour latest analysis is ready. Review the findings and share them with your team.",
  };
  const table = createConceptElement("table");
  return {
    boxes: {
      [navbar.id]: { height: 90, width: 1440, x: 0, y: 0 },
      [heading.id]: { height: 70, width: 1000, x: 48, y: 128 },
      [card.id]: { height: 250, width: 360, x: 48, y: 240 },
      [table.id]: { height: 500, width: 936, x: 456, y: 240 },
    },
    concept: {
      ...concept,
      background: "#ffffff",
      elements: [navbar, heading, card, table],
    },
    height: 900,
    kitId: kit.id,
    version: 1,
    width: 1440,
  };
};

it("fits the page workspace at desktop and narrow widths", async () => {
  await page.viewport(1440, 1000);
  await mount(sample());
  await document.fonts.ready;
  await page.screenshot({ path: "../../../.impeccable/review/desktop.png" });
  const sheet = host.querySelector<HTMLElement>(".page-design__sheet");
  const stage = host.querySelector<HTMLElement>(".page-builder__stage");
  expect(sheet?.getBoundingClientRect().width ?? 0).toBeGreaterThan(500);
  expect(sheet?.getBoundingClientRect().width ?? 0).toBeLessThanOrEqual(
    (stage?.clientWidth ?? 0) + 1
  );
  await page.viewport(700, 900);
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await page.screenshot({ path: "../../../.impeccable/review/mobile.png" });
  expect(sheet?.getBoundingClientRect().width ?? 0).toBeLessThanOrEqual(
    (stage?.clientWidth ?? 0) + 1
  );
});

it("plays the chosen click target in the same live page renderer", async () => {
  await mount();
  const design = sample();
  const button = { ...createConceptElement("button"), text: "Open findings" };
  const result = {
    ...createConceptElement("text"),
    text: "The findings are open",
  };
  design.concept = {
    ...design.concept,
    elements: [button],
    steps: [{ caption: "Results", elements: [result], id: "result" }],
    stepTrigger: button.id,
  };
  await act(() => root.render(<PageDesignView page={design} />));
  await userEvent.click(
    host.querySelector(".page-design__component button") as HTMLButtonElement
  );
  expect(host.textContent).toContain("The findings are open");
  expect(host.textContent).not.toContain("Open findings");
});
