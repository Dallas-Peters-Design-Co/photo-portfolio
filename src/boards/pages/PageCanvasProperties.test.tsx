import "../../index.css";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import {
  createConcept,
  createConceptElement,
} from "../../../config/conceptDefaults.js";
import { cleanPageDesign } from "../../../config/pageDesign.js";

import {
  cleanup,
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

const SELECT_LAYER = /^select\s*Choose an option/i;

it("edits the Select placeholder and keeps it when the page reopens", async () => {
  const select = createConceptElement("select");
  await mount({
    boxes: {},
    concept: { ...createConcept(), elements: [select] },
    height: 450,
    kitId: null,
    version: 1,
    width: 720,
  });
  const layer = page.getByRole("button", {
    name: SELECT_LAYER,
  });
  await act(() => layer.click());
  await act(() =>
    page
      .getByRole("textbox", { exact: true, name: "Placeholder" })
      .fill("Choose a country")
  );
  const saved = latest;
  if (!saved) {
    throw new Error("Expected the placeholder edit to save");
  }
  const trigger = () =>
    host.querySelector(".page-design__sheet [data-slot='select-trigger']");
  expect(
    trigger()?.querySelector('[data-slot="select-value"]')?.textContent
  ).toBe("Choose a country");
  expect(saved.concept.elements[0]?.options).toEqual(select.options);
  await act(() => root.unmount());
  host.remove();
  await mount(saved);
  expect(
    trigger()?.querySelector('[data-slot="select-value"]')?.textContent
  ).toBe("Choose a country");
  expect(trigger()?.hasAttribute("data-placeholder")).toBe(true);
});

it("fills the assigned Select box at different widths", async () => {
  const select = createConceptElement("select");
  await page.viewport(1440, 900);
  await mount({
    boxes: { [select.id]: { height: 60, width: 460, x: 0, y: 0 } },
    concept: { ...createConcept(), elements: [select] },
    height: 450,
    kitId: null,
    version: 1,
    width: 720,
  });
  const box = host.querySelector(".page-design__component");
  const trigger = box?.querySelector("[data-slot='select-trigger']");
  if (!(box && trigger)) {
    throw new Error("Expected a Select on the page");
  }
  const checkWidth = (width: number) => {
    expect(box.getBoundingClientRect().width).toBeCloseTo(width, 0);
    expect(trigger.getBoundingClientRect().width).toBeCloseTo(width, 0);
  };
  checkWidth(460);
  await act(() => page.getByRole("button", { name: SELECT_LAYER }).click());
  await act(() =>
    page.getByRole("spinbutton", { exact: true, name: "WIDTH" }).fill("240")
  );
  checkWidth(240);
});

it("sets and removes a table button's icon independently of other rows", async () => {
  const table = createConceptElement("table");
  table.table = {
    columns: [{ kind: "button", label: "Action" }],
    rows: [["Open"], ["Edit"]],
  };
  await page.viewport(1440, 900);
  await mount({
    boxes: {},
    concept: { ...createConcept(), elements: [table] },
    height: 500,
    kitId: null,
    version: 1,
    width: 720,
  });
  const layer = host.querySelector<HTMLButtonElement>(".page-builder__layer");
  await act(() => layer?.click());
  const controls = page.getByLabelText("Row 2, Action icons", { exact: true });
  await act(() => controls.click());
  const trailing = page.getByRole("button", {
    name: "Row 2, Action, Trailing icon",
  });
  await act(() => trailing.click());
  await act(() => page.getByTitle("Favourite", { exact: true }).click());
  const buttons = () =>
    host.querySelectorAll(".page-design__sheet .concept-table__button");
  expect(buttons()[0]?.querySelector("svg")).toBeNull();
  expect(buttons()[1]?.querySelector("svg")).toBeTruthy();
  const saved = cleanPageDesign(latest);
  if (!saved) {
    throw new Error("Missing saved page");
  }
  expect(
    saved.concept.elements[0]?.table?.columns[0]?.itemIcons?.[1]?.end
  ).toBe("FavouriteIcon");
  await act(() => root.unmount());
  host.remove();
  await mount(saved);
  expect(buttons()[1]?.querySelector("svg")).toBeTruthy();
  await act(() =>
    host.querySelector<HTMLButtonElement>(".page-builder__layer")?.click()
  );
  await act(() => controls.click());
  await act(() => trailing.click());
  await act(() => page.getByRole("option", { name: "No icon" }).click());
  expect(buttons()[1]?.textContent).toBe("Edit");
  expect(buttons()[1]?.querySelector("svg")).toBeNull();
});

it("edits multiline Text content inside a panel with its child properties folded", async () => {
  const child = { ...createConceptElement("text"), text: "Panel copy" };
  const panel = {
    ...createConceptElement("panel"),
    slots: { body: { elements: [child] } },
  };
  await mount({
    boxes: {},
    concept: { ...createConcept(), elements: [panel] },
    height: 450,
    kitId: null,
    version: 1,
    width: 720,
  });
  const layer = host.querySelector<HTMLButtonElement>(".page-builder__layer");
  await act(() => layer?.click());
  const childSection = host.querySelector(
    '.page-builder__inspector section[aria-label="text"]'
  );
  expect(
    childSection
      ?.querySelector(".review-concepts__element-toggle")
      ?.getAttribute("aria-expanded")
  ).toBe("false");
  const content = page.getByRole("textbox", {
    exact: true,
    name: "Text content",
  });
  const copy = "A new heading\nA second line";
  await act(() => content.fill(copy));
  const saved = cleanPageDesign(latest);
  if (!saved) {
    throw new Error("Missing saved page");
  }
  expect(saved.concept.elements[0]?.slots?.body?.elements[0]?.text).toBe(copy);
  await act(() => root.unmount());
  host.remove();
  await mount(saved);
  const textLayer = [
    ...host.querySelectorAll<HTMLButtonElement>(".page-builder__layer"),
  ].find((item) => item.textContent?.includes("A new heading"));
  await act(() => textLayer?.click());
  expect((content.element() as HTMLTextAreaElement).value).toBe(copy);
  expect(host.querySelector(".concept-panel__surface")?.textContent).toContain(
    copy
  );
});

it("shows only the selected component or group outline and clears it on blank canvas", async () => {
  const child = { ...createConceptElement("text"), text: "Nested copy" };
  const group = {
    ...createConceptElement("group"),
    group: { elements: [child] },
  };
  const button = { ...createConceptElement("button"), text: "Continue" };
  await mount({
    boxes: {},
    concept: { ...createConcept(), elements: [group, button] },
    height: 500,
    kitId: null,
    version: 1,
    width: 720,
  });
  const outlines = () =>
    host.querySelectorAll(
      ".page-builder__selection, .page-builder__stage [data-selected]"
    );
  expect(outlines()).toHaveLength(0);
  await act(() =>
    page.getByRole("button", { exact: true, name: "Move group" }).click()
  );
  expect(outlines()).toHaveLength(1);
  expect(
    host.querySelector(".page-builder__resize")?.getAttribute("aria-label")
  ).toBe("Resize group");
  const nestedLayer = [
    ...host.querySelectorAll<HTMLButtonElement>(".page-builder__layer"),
  ].find((layer) => layer.textContent?.includes("Nested copy"));
  await act(() => nestedLayer?.click());
  expect(outlines()).toHaveLength(1);
  expect(outlines()[0]?.textContent).toBe("Nested copy");
  await act(() =>
    page.getByRole("button", { exact: true, name: "Move Continue" }).click()
  );
  expect(outlines()).toHaveLength(1);
  expect(
    host.querySelector(".page-builder__resize")?.getAttribute("aria-label")
  ).toBe("Resize Continue");
  const sheet = host.querySelector(".page-design__sheet");
  await act(() => {
    sheet?.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, button: 0 })
    );
  });
  expect(outlines()).toHaveLength(0);
  expect(host.querySelector(".page-builder__resize")).toBeNull();
});

it("moves a group into a missing slot from Layers and ungroups its children there", async () => {
  const children = [
    createConceptElement("button"),
    createConceptElement("text"),
  ];
  const group = {
    ...createConceptElement("group"),
    group: { elements: children },
    text: "Actions",
  };
  const card = {
    ...createConceptElement("card"),
    slots: { header: { elements: [group] } },
    text: "Account",
  };
  await mount({
    boxes: {},
    concept: { ...createConcept(), elements: [card] },
    height: 500,
    kitId: null,
    version: 1,
    width: 720,
  });
  const handle = host.querySelector(
    `[data-sortable-id="${group.id}"] .sortable__handle`
  );
  if (!handle) {
    throw new Error("Missing group handle");
  }
  const init = {
    bubbles: true,
    cancelable: true,
    dataTransfer: new DataTransfer(),
  };
  await act(() => {
    handle.dispatchEvent(new DragEvent("dragstart", init));
  });
  const footer = page
    .getByRole("button", { name: "footer slot of Account" })
    .element();
  await act(() => {
    footer.dispatchEvent(new DragEvent("dragover", init));
    footer.dispatchEvent(new DragEvent("drop", init));
  });
  expect(latest?.concept.elements[0].slots?.footer?.elements[0].id).toBe(
    group.id
  );
  await act(() =>
    page.getByRole("button", { exact: true, name: "Ungroup" }).click()
  );
  const slots = cleanPageDesign(latest)?.concept.elements[0].slots;
  expect(slots?.header?.elements).toHaveLength(0);
  expect(slots?.footer?.elements.map((el) => el.id)).toEqual(
    children.map((el) => el.id)
  );
});

it("drags from a card footer handle onto another slot in the inspector", async () => {
  const child = createConceptElement("button");
  const card = {
    ...createConceptElement("card"),
    slots: { body: { elements: [child] }, footer: { elements: [], gap: 17 } },
    text: "Inspector card",
  };
  await mount({
    boxes: {},
    concept: { ...createConcept(), elements: [card] },
    height: 500,
    kitId: null,
    version: 1,
    width: 720,
  });
  await act(() =>
    page
      .getByRole("button", { exact: true, name: "Move Inspector card" })
      .click()
  );
  const panel = host.querySelector(".page-builder__inspector");
  const handle = panel?.querySelector(
    ".review-concepts__element-footer [draggable=true]"
  );
  const footer = [
    ...(panel?.querySelectorAll(".review-concepts__element-head") ?? []),
  ].find((el) => el.textContent?.includes("In the footer"));
  if (!(handle && footer)) {
    throw new Error("Missing inspector drag target");
  }
  const init = {
    bubbles: true,
    cancelable: true,
    dataTransfer: new DataTransfer(),
  };
  await act(() => {
    handle.dispatchEvent(new DragEvent("dragstart", init));
  });
  await act(() => {
    footer.dispatchEvent(new DragEvent("drop", init));
  });
  const slots = cleanPageDesign(latest)?.concept.elements[0].slots;
  expect(slots?.body?.elements).toHaveLength(0);
  expect(slots?.footer).toMatchObject({
    elements: [{ id: child.id }],
    gap: 17,
  });
});

it("places a nested component across grid tracks and restores automatic placement", async () => {
  const child = { ...createConceptElement("button"), text: "Grid action" };
  const group = {
    ...createConceptElement("group"),
    group: { columns: 4, elements: [child], layout: "grid" as const },
  };
  await mount({
    boxes: {},
    concept: { ...createConcept(), elements: [group] },
    height: 450,
    kitId: null,
    version: 1,
    width: 720,
  });
  const layer = [
    ...host.querySelectorAll<HTMLButtonElement>(".page-builder__layer"),
  ].find((button) => button.textContent?.includes("Grid action"));
  if (!layer) {
    throw new Error("Missing nested layer");
  }
  await act(() => layer.click());
  const edit = (name: string, value: string) =>
    act(() => page.getByRole("spinbutton", { exact: true, name }).fill(value));
  await edit("Column", "2");
  await edit("Row", "3");
  await edit("Column span", "2");
  await edit("Row span", "4");
  const placed = host.querySelector(".concept-grid-item");
  if (!placed) {
    throw new Error("Missing placed item");
  }
  expect(getComputedStyle(placed).gridColumn).toBe("2 / span 2");
  expect(getComputedStyle(placed).gridRow).toBe("3 / span 4");
  expect(
    cleanPageDesign(latest)?.concept.elements[0].group?.elements[0]
      .gridPlacement
  ).toEqual({ column: 2, columnSpan: 2, row: 3, rowSpan: 4 });
  await edit("Column", "");
  expect(getComputedStyle(placed).gridColumn).toBe("auto / span 2");
});
