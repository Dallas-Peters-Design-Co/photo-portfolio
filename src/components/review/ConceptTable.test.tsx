import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import type { ReviewConceptElement } from "../../../config/reviewConcept.js";
import { createConceptElement } from "../admin/ReviewConceptBrand";
import { ReviewConceptElementFields } from "../admin/ReviewConceptElementFields";
import { ReviewConceptElementView } from "./ReviewConceptElementView";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function Harness() {
  const [table, setTable] = useState<ReviewConceptElement>(() =>
    createConceptElement("table")
  );
  return (
    <>
      <ReviewConceptElementFields
        element={table}
        onChange={(patch) => setTable({ ...table, ...patch })}
        onDuplicate={() => undefined}
        onRemove={() => undefined}
      />
      <div data-testid="preview">
        <ReviewConceptElementView element={table} />
      </div>
    </>
  );
}

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(<Harness />));
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const preview = () =>
  host.querySelector('[data-testid="preview"] table') as HTMLTableElement;
const field = (label: string) =>
  host.querySelector(`[aria-label="${label}"]`) as HTMLInputElement;

it("draws each column's cells by type: two lines, a tag, chips", () => {
  const [project, status, tags] = [
    ...preview().querySelectorAll("tbody tr:first-child td"),
  ];
  expect(project?.querySelector("small")?.textContent).toBe("Acme Co.");
  expect(status?.querySelector(".concept-table__tag")?.textContent).toBe(
    "Active"
  );
  expect(
    [...(tags?.querySelectorAll(".concept-table__chip") ?? [])].map(
      (chip) => chip.textContent
    )
  ).toEqual(["Design", "Web"]);
});

it("edits a two-line cell in two boxes and adds a row", async () => {
  await userEvent.clear(field("Row 1, Project, second line"));
  await userEvent.type(field("Row 1, Project, second line"), "Globex");
  expect(
    preview().querySelector("tbody tr:first-child small")?.textContent
  ).toBe("Globex");

  const add = [...host.querySelectorAll("button")].find((button) =>
    button.textContent?.includes("Add row")
  );
  await userEvent.click(add as HTMLElement);
  expect(preview().querySelectorAll("tbody tr")).toHaveLength(3);
});

it("draws grid lines, an outline, or no lines, in the chosen width and colour", () => {
  const draw = (borders: object) =>
    act(() =>
      root.render(
        <ReviewConceptElementView
          element={{
            ...createConceptElement("table"),
            table: {
              ...(createConceptElement("table").table as object),
              borders,
            } as never,
          }}
        />
      )
    );
  draw({ color: "#ff0000", lines: "grid", outline: true, width: 3 });
  const cell = host.querySelector("td") as HTMLElement;
  expect(getComputedStyle(cell).borderLeftWidth).toBe("3px");
  expect(getComputedStyle(cell).borderLeftColor).toBe("rgb(255, 0, 0)");
  expect(
    getComputedStyle(host.querySelector("table") as HTMLElement).outlineStyle
  ).toBe("solid");

  draw({ lines: "none", outline: false, width: 1 });
  expect(
    getComputedStyle(host.querySelector("td") as HTMLElement).borderBottomStyle
  ).toBe("none");
});
