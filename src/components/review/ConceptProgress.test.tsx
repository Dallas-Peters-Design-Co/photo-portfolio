import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import {
  addColumn,
  setCell,
  setColumnKind,
} from "../../../config/conceptTable.js";
import type { ReviewConceptElement } from "../../../config/reviewConcept.js";
import { createConceptElement } from "../admin/ReviewConceptBrand";
import { ReviewConceptElementView } from "./ReviewConceptElementView";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  host = document.createElement("div");
  host.style.width = "400px";
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const draw = (element: ReviewConceptElement) =>
  act(() => root.render(<ReviewConceptElementView element={element} />));

it("draws a progress element as a bar filled to its value, in its colours", () => {
  draw({
    ...createConceptElement("progress"),
    accentColor: "#ff0000",
    background: "#00ff00",
    progress: 25,
  });
  const bar = host.querySelector<HTMLElement>('[role="progressbar"]');
  expect(bar?.getAttribute("aria-valuenow")).toBe("25");
  const fill = bar?.firstElementChild as HTMLElement;
  expect(getComputedStyle(fill).backgroundColor).toBe("rgb(255, 0, 0)");
  expect(getComputedStyle(bar as HTMLElement).backgroundColor).toBe(
    "rgb(0, 255, 0)"
  );
  const ratio =
    fill.getBoundingClientRect().width /
    (bar as HTMLElement).getBoundingClientRect().width;
  expect(ratio).toBeCloseTo(0.25, 2);
  expect(host.textContent).toContain("Upload progress");
  expect(host.textContent).toContain("25%");
});

it("hides the percentage when told to", () => {
  draw({ ...createConceptElement("progress"), showValue: false });
  expect(host.textContent).not.toContain("%");
});

it("draws a table's Progress column as bars, words turned to 50%", () => {
  const table = createConceptElement("table");
  const base = table.table;
  if (!base) {
    throw new Error("A new table has a sample");
  }
  const withColumn = addColumn(base);
  const last = withColumn.columns.length - 1;
  const typed = setColumnKind(
    setCell(withColumn, 0, last, "80"),
    last,
    "progress"
  );
  draw({ ...table, table: typed });
  const bars = [
    ...host.querySelectorAll<HTMLElement>('[role="progressbar"]'),
  ].map((bar) => bar.getAttribute("aria-valuenow"));
  expect(bars[0]).toBe("80");
  expect(bars.slice(1).every((value) => value === "50")).toBe(true);
});

it("heads a table's progress bar with its description, words kept as one", () => {
  const table = createConceptElement("table");
  const base = table.table;
  if (!base) {
    throw new Error("A new table has a sample");
  }
  const withColumn = addColumn(base);
  const last = withColumn.columns.length - 1;
  // Words already in the column become the description of a half-full bar.
  const typed = setColumnKind(
    setCell(setCell(withColumn, 0, last, "Design handoff"), 1, last, "80"),
    last,
    "progress"
  );
  draw({ ...table, table: typed });
  const cells = [
    ...host.querySelectorAll<HTMLElement>(".concept-table__progress"),
  ];
  expect(cells[0]?.textContent).toBe("Design handoff50%");
  expect(
    cells[0]
      ?.querySelector('[role="progressbar"]')
      ?.getAttribute("aria-valuenow")
  ).toBe("50");
  // The line sits above the bar.
  const line = cells[0]?.querySelector("span > span") as HTMLElement;
  const bar = cells[0]?.querySelector('[role="progressbar"]') as HTMLElement;
  expect(line.getBoundingClientRect().bottom).toBeLessThanOrEqual(
    bar.getBoundingClientRect().top + 1
  );
  // No description: the percent beside the bar, as before.
  expect(cells[1]?.hasAttribute("data-labelled")).toBe(false);
  expect(cells[1]?.textContent).toBe("80%");
});
