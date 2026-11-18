import "../../index.css";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { createConceptElement } from "../../../config/conceptDefaults.js";
import type { ConceptTableColumn } from "../../../config/conceptTable.js";
import { ConceptTableFields } from "./ConceptTableFields";
import "./ReviewConceptsEditor.css";
import "../../boards/pages/PageCanvasEditor.css";

it("keeps seven labeled fields and the open icon library inside a resized inspector", async () => {
  await page.viewport(1440, 900);
  const columns: ConceptTableColumn[] = [
    { kind: "stacked", label: "Project" },
    { kind: "tag", label: "Status" },
    { kind: "text", label: "Availability" },
    { kind: "progress", label: "Stage" },
    { kind: "text", label: "Last updated" },
    { kind: "icon", label: "File" },
    { kind: "button", label: "Contact" },
  ];
  const row = ["LMX", "Active", "1 Available", "50", "Today", "", "Contact"];
  const element = {
    ...createConceptElement("table"),
    table: { columns, rows: [row, row] },
  };
  const host = document.createElement("aside");
  host.className = "page-builder__inspector";
  document.body.append(host);
  const root = createRoot(host);
  try {
    host.style.width = "280px";
    await act(() =>
      root.render(<ConceptTableFields element={element} onChange={vi.fn()} />)
    );
    const firstRow = host.querySelector(".review-concepts__table-row");
    if (!firstRow) {
      throw new Error("Missing row editor");
    }
    const cells = [
      ...firstRow.querySelectorAll(".review-concepts__table-cell"),
    ];
    expect(
      cells.map(
        (cell) =>
          cell.querySelector(".review-concepts__table-caption")?.textContent
      )
    ).toEqual(columns.map((column) => column.label));
    await act(() =>
      page.getByLabelText("Row 1, Availability icons", { exact: true }).click()
    );
    await act(() =>
      page
        .getByRole("button", {
          exact: true,
          name: "Row 1, Availability, Leading icon",
        })
        .click()
    );
    for (const width of [180, 280, 520]) {
      host.style.width = `${width}px`;
      const area = firstRow.getBoundingClientRect();
      for (const cell of cells) {
        const bounds = cell.getBoundingClientRect();
        expect(bounds.width).toBeGreaterThan(130);
        for (const control of cell.querySelectorAll(
          "input, summary, [role=listbox], button[aria-haspopup]"
        )) {
          if (!control.getClientRects().length) {
            continue;
          }
          const rect = control.getBoundingClientRect();
          expect(
            rect.right,
            `${width}px: ${control.outerHTML.slice(0, 220)}`
          ).toBeLessThanOrEqual(Math.ceil(Math.min(bounds.right, area.right)));
          expect(rect.left).toBeGreaterThanOrEqual(Math.floor(bounds.left));
        }
      }
      const [first, second] = cells.map((cell) => cell.getBoundingClientRect());
      if (width === 520) {
        expect(second.top).toBe(first.top);
      } else {
        expect(second.top).toBeGreaterThanOrEqual(first.bottom);
      }
    }
  } finally {
    await act(() => root.unmount());
    host.remove();
  }
});
