import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { componentSource } from "../../../config/componentSource.js";
import { createConceptElement } from "../../../config/conceptDefaults.js";
import type { ConceptIconSvg } from "../../../config/conceptIcon.js";
import { applyColumnStyles } from "../../../config/conceptStyle.js";
import {
  cleanConcept,
  type ReviewConceptElement,
} from "../../../config/reviewConcept.js";
import { ReviewConceptElementFields } from "../admin/ReviewConceptElementFields";
import { ReviewConceptElementView } from "./ReviewConceptElementView";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let latest: ReviewConceptElement;
function Harness() {
  const [table, setTable] = useState<ReviewConceptElement>(() =>
    createConceptElement("table")
  );
  latest = table;
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

it("styles a column's cell items and retains the appearance when reopened and exported", async () => {
  const columns = host.querySelectorAll<HTMLElement>(
    ".review-concepts__table-column"
  );
  const [, status] = columns;
  const details = status?.querySelector<HTMLDetailsElement>(
    ".review-concepts__cell-style"
  );
  expect(details).toBeTruthy();
  await userEvent.click(details?.querySelector("summary") as HTMLElement);
  const radius = details?.querySelector<HTMLInputElement>(
    '[aria-label="Radius"]'
  );
  await userEvent.clear(radius as HTMLInputElement);
  await userEvent.type(radius as HTMLInputElement, "12");
  const item = preview().querySelector<HTMLElement>(".concept-table__tag");
  expect(getComputedStyle(item as HTMLElement).borderRadius).toBe("12px");
  const [reopened] = cleanConcept({ elements: [latest] }).elements;
  expect(reopened?.table?.columns[1]?.look?.radius).toBe(12);
  expect(
    componentSource(reopened as ReviewConceptElement, "Primary").css
  ).toContain("border-radius: 12px");
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

  const lastCell = () =>
    host.querySelector("tbody tr:last-child td") as HTMLTableCellElement;
  expect(getComputedStyle(cell).borderBottomWidth).toBe("3px");
  expect(getComputedStyle(lastCell()).borderBottomWidth).toBe("0px");
  expect(getComputedStyle(lastCell()).borderRightWidth).toBe("3px");

  draw({ lines: "rows", outline: false, width: 2 });
  expect(
    getComputedStyle(host.querySelector("td") as HTMLElement).borderBottomWidth
  ).toBe("2px");
  lastCell().style.border = "4px solid red";
  expect(getComputedStyle(lastCell()).borderBottomWidth).toBe("0px");

  draw({ lines: "none", outline: false, width: 1 });
  expect(
    getComputedStyle(host.querySelector("td") as HTMLElement).borderBottomStyle
  ).toBe("none");
});

it("draws icon and button cells and the header's colours", () => {
  act(() =>
    root.render(
      <ReviewConceptElementView
        element={{
          ...createConceptElement("table"),
          table: {
            columns: [
              { color: "#ff0000", kind: "icon", label: "Icon" },
              {
                buttonStyle: "outline",
                color: "#0000ff",
                kind: "button",
                label: "Act",
              },
            ],
            header: { background: "#eeeeee", color: "#00aa00" },
            icons: { FavouriteIcon: [["path", { d: "M1 1h2" }]] },
            rows: [["FavouriteIcon", "Open"]],
          },
        }}
      />
    )
  );
  expect(host.querySelector("td svg")?.getAttribute("role")).toBe("img");
  const button = host.querySelector(".concept-table__button") as HTMLElement;
  expect(button.dataset.style).toBe("outline");
  expect(getComputedStyle(button).color).toBe("rgb(0, 0, 255)");
  const head = host.querySelector("th") as HTMLElement;
  expect(
    getComputedStyle(host.querySelector("thead") as HTMLElement).backgroundColor
  ).toBe("rgb(238, 238, 238)");
  expect(getComputedStyle(head).color).toBe("rgb(0, 170, 0)");
});

it("moves a column with its drag handle's arrow keys, cells and all", async () => {
  const handle = host.querySelector(
    '[aria-label="Move column Project (drag, or use the arrow keys)"]'
  ) as HTMLElement;
  handle.focus();
  await userEvent.keyboard("{ArrowDown}");
  const heads = [...preview().querySelectorAll("th")].map(
    (th) => th.textContent
  );
  expect(heads).toEqual(["Status", "Project", "Tags"]);
  expect(
    preview().querySelector("tbody tr:first-child td:nth-child(2) small")
      ?.textContent
  ).toBe("Acme Co.");
});

it("keeps what a table draws inside its own box", () => {
  expect(getComputedStyle(preview()).contain).toBe("paint");
});

it("draws a linked column's tags with its kit style's look", () => {
  act(() =>
    root.render(
      <ReviewConceptElementView
        element={{
          ...createConceptElement("table"),
          table: {
            columns: [
              {
                kind: "tag",
                label: "Status",
                look: { background: "#ecfdf3", color: "#027a48", radius: 4 },
                styleId: "pill",
              },
            ],
            rows: [["Active"]],
          },
        }}
      />
    )
  );
  const tag = getComputedStyle(
    host.querySelector(".concept-table__tag") as HTMLElement
  );
  expect(tag.backgroundColor).toBe("rgb(236, 253, 243)");
  expect(tag.color).toBe("rgb(2, 122, 72)");
  expect(tag.borderTopLeftRadius).toBe("4px");
});

it("scrolls a table wider than its space, columns at their set widths", () => {
  host.style.width = "320px";
  const table = createConceptElement("table");
  const base = table.table;
  if (!base) {
    throw new Error("A new table has a sample");
  }
  const wide = {
    ...base,
    columns: base.columns.map((column) => ({ ...column, width: 200 })),
  };
  act(() =>
    root.render(
      <ReviewConceptElementView element={{ ...table, table: wide }} />
    )
  );
  const box = host.querySelector<HTMLElement>(".concept-table-scroll");
  const heads = [...host.querySelectorAll<HTMLElement>("th")];
  // Each column at its width; together wider than the box, which scrolls.
  for (const head of heads) {
    expect(Math.round(head.getBoundingClientRect().width)).toBe(200);
  }
  expect(box?.getBoundingClientRect().width).toBeLessThanOrEqual(320);
  expect(box?.scrollWidth).toBeGreaterThan(box?.clientWidth ?? 0);
  expect(getComputedStyle(box as HTMLElement).overflowX).toBe("auto");
  // It scrolls without a bar: the bar takes no height.
  expect(getComputedStyle(box as HTMLElement).scrollbarWidth).toBe("none");
  expect(box?.offsetHeight).toBe(box?.clientHeight);
});

it("reopens and exports a borderless kit button with its icons and row overrides", () => {
  const button = {
    id: "borderless",
    kind: "button" as const,
    look: {
      borderWidth: 0,
      iconColor: "#345678",
      iconEndName: "ArrowRight01Icon",
      iconEndSvg: [["path", { d: "M2 2h4" }]] as ConceptIconSvg,
      iconName: "HeartIcon",
      iconSize: 20,
      iconSvg: [["path", { d: "M1 1h2" }]] as ConceptIconSvg,
    },
    name: "Borderless",
  };
  const table = applyColumnStyles(
    {
      ...createConceptElement("table"),
      table: {
        columns: [
          {
            itemIcons: { 1: { end: "StarIcon", start: null } },
            kind: "button",
            label: "Actions",
            styleId: "borderless",
          },
        ],
        icons: { StarIcon: [["path", { d: "M3 3h6" }]] },
        rows: [[""], ["Open"]],
      },
    },
    [button]
  );
  const [saved] = cleanConcept({ elements: [table] }).elements;
  act(() => root.render(<ReviewConceptElementView element={saved} />));
  const buttons = host.querySelectorAll(".concept-table__button");
  expect(buttons).toHaveLength(2);
  const paths = (el: Element) =>
    [...el.querySelectorAll("path")].map((p) => p.getAttribute("d"));
  expect(paths(buttons[0])).toEqual(["M1 1h2", "M2 2h4"]);
  expect(paths(buttons[1])).toEqual(["M3 3h6"]);
  const icon = buttons[0].querySelector("svg") as SVGElement;
  expect(getComputedStyle(icon).width).toBe("20px");
  expect(getComputedStyle(icon).color).toBe("rgb(52, 86, 120)");
  const markup = componentSource(saved, "Primary").preview;
  expect(markup).toContain('aria-label={"Actions"}');
  expect(markup.match(/d="M1 1h2"/g)).toHaveLength(1);
  expect(markup).toContain('d="M3 3h6"');
});

it("edits one cell's item and box and resets it to its column", async () => {
  const cell = host.querySelector(
    '[aria-label="Row 1, Status style"]'
  ) as HTMLElement;
  await userEvent.click(cell);
  const panel = cell.parentElement as HTMLElement;
  const expand = async (title: string) => {
    const summary = [...panel.querySelectorAll("summary")].find(
      (s) => s.textContent === title
    ) as HTMLElement;
    await userEvent.click(summary);
    return summary.parentElement as HTMLElement;
  };
  const change = async (
    panelElement: HTMLElement,
    name: string,
    value: string
  ) => {
    const input = panelElement.querySelector(
      `[aria-label="${name}"]`
    ) as HTMLInputElement;
    await userEvent.clear(input);
    await userEvent.type(input, value);
  };
  await change(await expand("Cell item style"), "Radius", "17");
  await change(await expand("Cell box"), "Padding X", "31");
  const [first, second] = host.querySelectorAll<HTMLElement>(
    '[data-testid="preview"] .concept-table__tag'
  );
  expect(getComputedStyle(first).borderRadius).toBe("17px");
  expect(getComputedStyle(second).borderRadius).not.toBe("17px");
  expect(getComputedStyle(first.closest("td") as HTMLElement).paddingLeft).toBe(
    "31px"
  );
  const [saved] = cleanConcept({ elements: [latest] }).elements;
  expect(saved.table?.columns[1].cells?.[0]).toEqual({
    box: { paddingX: 31 },
    overrides: { radius: 17 },
  });
  await userEvent.click(
    [...panel.querySelectorAll("button")].find(
      (b) => b.textContent === "Reset to column"
    ) as HTMLElement
  );
  expect(getComputedStyle(first).borderRadius).toBe(
    getComputedStyle(second).borderRadius
  );
});
