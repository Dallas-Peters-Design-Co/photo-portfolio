import { parsePaletteToken } from "../../../config/paletteBinding.js";
import "../../index.css";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import {
  createConcept,
  createConceptElement,
} from "../../../config/conceptDefaults.js";
import {
  cleanPageDesign,
  type PageDesign,
} from "../../../config/pageDesign.js";
import { componentsApi } from "../creative/components/componentsApi";
import { PageDesignView } from "./PageDesignView";

import {
  changed,
  cleanup,
  closed,
  host,
  kit,
  latest,
  mount,
  root,
} from "./pageCanvasTestHarness";

vi.mock("../brand/ActiveBrand", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../brand/ActiveBrand")>()),
  useActiveBrand: () => ({ kit, kits: [kit] }),
}));

afterEach(cleanup);

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
    host.querySelector('[aria-label="Content"]') as HTMLInputElement,
    "Continue"
  );
  expect(latest?.concept.elements[0]).toMatchObject({
    styleId: "primary",
    text: "Continue",
  });
});

it("attaches an interactive tooltip to a page component", async () => {
  await mount();
  await act(() =>
    host.querySelector<HTMLButtonElement>(".page-builder__insert")?.click()
  );
  const add = [...host.querySelectorAll("label")].find((label) =>
    label.textContent?.includes("Add tooltip")
  );
  await userEvent.click(add as HTMLElement);
  const interactive = [...host.querySelectorAll("label")].find((label) =>
    label.textContent?.includes("Interactive on hover")
  );
  await userEvent.click(interactive as HTMLElement);
  await userEvent.clear(
    host.querySelector<HTMLInputElement>(
      '[aria-label="Tooltip text"]'
    ) as HTMLElement
  );
  await userEvent.type(
    host.querySelector<HTMLInputElement>(
      '[aria-label="Tooltip text"]'
    ) as HTMLElement,
    "Page hint"
  );
  expect(latest?.concept.elements[0]?.tooltip).toMatchObject({
    interactive: true,
    text: "Page hint",
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
      props: [
        {
          field: "body",
          id: "heading",
          lid: "title",
          name: "Heading",
          type: "text",
        },
      ],
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
  const panel = createConceptElement("panel");
  const sibling = createConceptElement("text");
  panel.slots = { body: { elements: [sibling], layout: "row" } };
  await act(() => root.unmount());
  host.remove();
  await mount({
    boxes: {},
    concept: { ...createConcept(), elements: [panel] },
    height: 480,
    kitId: kit.id,
    version: 1,
    width: 700,
  });
  await act(() =>
    host.querySelector<HTMLButtonElement>(".page-builder__layer")?.click()
  );
  await act(() =>
    page
      .getByRole("combobox", { exact: true, name: "Add to in the body" })
      .click()
  );
  await act(() =>
    page.getByRole("option", { exact: true, name: "Canvas header" }).click()
  );
  const saved = cleanPageDesign(latest);
  if (!saved) {
    throw new Error("Missing saved page");
  }
  const children = saved.concept.elements[0]?.slots?.body?.elements;
  expect(children?.map((item) => item.kind)).toEqual(["text", "canvas"]);
  expect(children?.[1]?.canvasComponent).toMatchObject({
    id: "page-component",
    props: [{ id: "heading", lid: "title" }],
  });
  await act(() => root.unmount());
  host.remove();
  await mount(saved);
  expect(
    host.querySelector(
      '.concept-panel__surface [data-slot="body"] .review-canvas-component'
    )?.textContent
  ).toContain("Canvas title");
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
    steps: [
      {
        caption: "Results",
        elements: [result],
        id: "result",
        trigger: result.id,
      },
    ],
    stepTrigger: button.id,
  };
  await act(() => root.render(<PageDesignView page={design} />));
  await userEvent.click(
    host.querySelector(".page-design__component button") as HTMLButtonElement
  );
  expect(host.textContent).toContain("The findings are open");
  expect(host.textContent).not.toContain("Open findings");
  await userEvent.click(
    page.getByText("The findings are open", { exact: true })
  );
  expect(host.textContent).toContain("Open findings");
  await page.getByRole("combobox", { name: "Prototype state" }).click();
  await page.getByRole("option", { exact: true, name: "Results" }).click();
  expect(host.textContent).toContain("The findings are open");
});

it("edits the placed panel's toggle position from the page inspector", async () => {
  const panel = createConceptElement("panel");
  await mount({
    boxes: {},
    concept: { ...createConcept(), elements: [panel] },
    height: 600,
    kitId: kit.id,
    version: 1,
    width: 900,
  });
  await act(() =>
    host.querySelector<HTMLButtonElement>(".page-builder__layer")?.click()
  );
  const picker = host.querySelector<HTMLElement>(
    '[aria-label="Panel toggle position"]'
  );
  if (!picker) {
    throw new Error("Missing panel toggle position");
  }
  await userEvent.click(picker);
  const option = [
    ...document.querySelectorAll<HTMLElement>('[role="option"]'),
  ].find((item) => item.textContent === "Left");
  if (!option) {
    throw new Error("Missing left toggle option");
  }
  await userEvent.click(option);
  expect(latest?.concept.elements[0]?.panelToggleSide).toBe("left");
  expect(
    host
      .querySelector(".page-design__sheet .concept-panel")
      ?.getAttribute("data-toggle-side")
  ).toBe("left");
});

it("removes a selected header item and keeps its panel and other slots", async () => {
  const panel = createConceptElement("panel");
  await mount({
    boxes: {},
    concept: { ...createConcept(), elements: [panel] },
    height: 600,
    kitId: kit.id,
    version: 1,
    width: 900,
  });
  const layer = [
    ...host.querySelectorAll<HTMLButtonElement>(".page-builder__layer"),
  ].find((item) => item.textContent?.startsWith("badge"));
  if (!layer) {
    throw new Error("Missing badge layer");
  }
  await act(() => layer.click());
  const remove = [
    ...host.querySelectorAll<HTMLButtonElement>(
      ".page-builder__inspector button"
    ),
  ].find((item) => item.textContent?.trim() === "Remove item");
  if (!remove) {
    throw new Error("Missing slot item removal");
  }
  await act(() => remove.click());
  const saved = latest?.concept.elements[0];
  expect(saved?.id).toBe(panel.id);
  expect(saved?.slots?.header?.elements ?? []).toHaveLength(0);
  expect(saved?.slots?.body?.elements.length).toBe(
    panel.slots?.body?.elements.length
  );
  expect(
    host.querySelector(".page-design__sheet [data-slot='header']")?.textContent
  ).toBe(panel.text);
});

it("wraps a placed item at its original position and moves a sibling into its group", async () => {
  const first = createConceptElement("button");
  const second = createConceptElement("badge");
  const box = { height: 130, width: 420, x: 100, y: 80 };
  await mount({
    boxes: { [first.id]: box },
    concept: { ...createConcept(), elements: [first, second] },
    height: 600,
    kitId: kit.id,
    version: 1,
    width: 900,
  });
  const select = async (kind: string) => {
    const layer = [
      ...host.querySelectorAll<HTMLButtonElement>(".page-builder__layer"),
    ].find((item) => item.textContent?.startsWith(kind));
    if (!layer) {
      throw new Error("Missing layer");
    }
    await act(() => layer.click());
  };
  const action = async (label: string) => {
    const button = [
      ...host.querySelectorAll<HTMLButtonElement>(
        ".page-builder__inspector button"
      ),
    ].find((item) => item.textContent === label);
    if (!button) {
      throw new Error(label);
    }
    await act(() => button.click());
  };
  await select("button");
  await action("Wrap in layout group");
  await select("badge");
  await action("Move into group above");
  const group = latest?.concept.elements[0];
  expect(latest?.concept.elements).toHaveLength(1);
  expect(group?.group?.elements.map((item) => item.id)).toEqual([
    first.id,
    second.id,
  ]);
  expect(latest?.boxes[group?.id ?? ""]).toEqual(box);
});

it("keeps the screen centered when either sidebar changes width", async () => {
  await page.viewport(1440, 900);
  await mount({
    boxes: {},
    concept: createConcept(),
    height: 320,
    kitId: null,
    version: 1,
    width: 480,
  });
  const rect = (selector: string) => {
    const el = host.querySelector(selector);
    if (!el) {
      throw new Error(`Missing ${selector}`);
    }
    return el.getBoundingClientRect();
  };
  const checkCenter = () => {
    const workspace = rect(".page-builder__workspace");
    const screen = rect(".page-design__sheet");
    expect(screen.x + screen.width / 2).toBeCloseTo(
      workspace.x + workspace.width / 2,
      0
    );
    expect(screen.y + screen.height / 2).toBeCloseTo(
      workspace.y + workspace.height / 2,
      0
    );
  };
  checkCenter();
  try {
    const resize = async (label: string, selector: string, key: string) => {
      const before = rect(selector).width;
      const edge = page.getByRole("separator", { name: `Resize the ${label}` });
      await act(() => {
        edge
          .element()
          .dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key }));
      });
      expect(rect(selector).width).toBe(before + 16);
      checkCenter();
    };
    await resize("component library", ".page-builder__library", "ArrowRight");
    await resize("inspector", ".page-builder__inspector", "ArrowLeft");
    await act(() =>
      page.getByRole("button", { exact: true, name: "Play" }).click()
    );
    checkCenter();
  } finally {
    localStorage.removeItem("page-builder:panels");
  }
});

it("applies the selected kit's swatch from the page background OKLCH picker", async () => {
  await page.viewport(1440, 900);
  await mount();
  await act(() =>
    page.getByRole("button", { exact: true, name: "Page background" }).click()
  );
  expect(
    document.querySelector('[aria-label="Lightness and chroma"]')
  ).not.toBeNull();
  const swatch = page.getByRole("button", {
    exact: true,
    name: "Harbor · Accent",
  });
  await act(() => swatch.click());
  expect(parsePaletteToken(latest?.concept.background ?? "")?.[2]).toBe(
    "#114477"
  );
  expect(
    getComputedStyle(host.querySelector(".page-design__sheet") as HTMLElement)
      .backgroundColor
  ).toBe("rgb(17, 68, 119)");
});

it("reorders page layers, group children and slot items while preserving positions", async () => {
  const text = (label: string) => ({
    ...createConceptElement("text"),
    text: label,
  });
  const group = {
    ...createConceptElement("group"),
    group: { elements: [text("First"), text("Second")] },
    text: "Stack",
  };
  const panel = {
    ...createConceptElement("panel"),
    slots: { body: { elements: [text("One"), text("Two")] } },
    text: "Surface",
  };
  await mount({
    boxes: {},
    concept: { ...createConcept(), elements: [group, panel] },
    height: 700,
    kitId: kit.id,
    version: 1,
    width: 900,
  });
  const move = async (label: string) => {
    const handle = page.getByRole("button", {
      exact: true,
      name: `Move ${label} (drag, or use the arrow keys)`,
    });
    (handle.element() as HTMLButtonElement).focus();
    await act(() => userEvent.keyboard("{ArrowDown}"));
  };
  await move("text layer First");
  await move("text layer One");
  await move("group layer Stack");
  const saved = cleanPageDesign(latest);
  expect(saved?.concept.elements.map((el) => el.id)).toEqual([
    panel.id,
    group.id,
  ]);
  expect(saved?.boxes[group.id]?.y).toBe(24);
  expect(saved?.boxes[panel.id]?.y).toBe(168);
  expect(
    saved?.concept.elements[0].slots?.body?.elements.map((el) => el.text)
  ).toEqual(["Two", "One"]);
  expect(
    saved?.concept.elements[1].group?.elements.map((el) => el.text)
  ).toEqual(["Second", "First"]);
  const components = host.querySelectorAll(".page-design__component");
  expect(components[0].textContent).toContain("Two");
  expect(components[1].textContent).toContain("Second");
});
