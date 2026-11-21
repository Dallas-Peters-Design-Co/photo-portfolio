import "../../index.css";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import {
  createConcept,
  createConceptElement,
} from "../../../config/conceptDefaults.js";
import { boxOf, cleanPageDesign } from "../../../config/pageDesign.js";
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

it("restacks overlapping layers by dragging the layer name and saves their positions", async () => {
  const card = { ...createConceptElement("card"), text: "Overview" };
  const label = { ...createConceptElement("label"), text: "Caption" };
  const box = { height: 120, width: 200, x: 24, y: 20 };
  await page.viewport(1440, 900);
  await mount({
    boxes: { [card.id]: box, [label.id]: box },
    concept: { ...createConcept(), elements: [card, label] },
    height: 450,
    kitId: null,
    version: 1,
    width: 720,
  });
  await act(() =>
    page
      .getByRole("button", { exact: true, name: "card Overview" })
      .dropTo(
        page.getByRole("button", { exact: true, name: "label Caption" }),
        { targetPosition: { x: 20, y: 27 } }
      )
  );
  const saved = cleanPageDesign(latest);
  if (!saved) {
    throw new Error("The drag did not save a page");
  }
  expect(saved.concept.elements.map((el) => el.id)).toEqual([
    label.id,
    card.id,
  ]);
  expect(saved.boxes).toEqual({ [card.id]: box, [label.id]: box });
  await act(() => root.unmount());
  host.remove();
  await mount(saved);
  expect(
    [...host.querySelectorAll("[data-page-layer]")].map((el) =>
      el.getAttribute("data-page-layer")
    )
  ).toEqual([label.id, card.id]);
});

it("inserts a linked kit component where it is dropped on a scaled page", async () => {
  await page.viewport(1440, 900);
  await mount({
    boxes: {},
    concept: { ...createConcept(), elements: [] },
    height: 800,
    kitId: kit.id,
    version: 1,
    width: 1200,
  });
  const sheet = host.querySelector<HTMLElement>(".page-design__sheet");
  if (!sheet) {
    throw new Error("Missing page sheet");
  }
  const scale = sheet.getBoundingClientRect().width / 1200;
  await act(() =>
    page
      .getByRole("button", { exact: true, name: "Insert Primary (Button)" })
      .dropTo(page.elementLocator(sheet), { targetPosition: { x: 100, y: 90 } })
  );
  const saved = cleanPageDesign(latest);
  if (!saved) {
    throw new Error("The drop did not add a component");
  }
  expect(saved.concept.elements).toHaveLength(1);
  const [item] = saved.concept.elements;
  expect(item.styleId).toBe("primary");
  const box = boxOf(saved, item.id, 0);
  expect(Math.abs(box.x * scale - 100)).toBeLessThan(2);
  expect(Math.abs(box.y * scale - 90)).toBeLessThan(2);
});
