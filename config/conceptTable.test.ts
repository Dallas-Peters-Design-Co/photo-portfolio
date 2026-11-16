import { describe, expect, it } from "vitest";
import {
  addColumn,
  addRow,
  chipsOf,
  cleanTable,
  DEFAULT_TABLE,
  MAX_TABLE_COLUMNS,
  removeColumn,
  removeRow,
  reorderColumns,
  setCell,
  setColumnKind,
  setIconCell,
  tableOf,
  updateBorders,
  updateColumn,
  updateHeader,
} from "./conceptTable.js";

describe("cleaning a table", () => {
  it("keeps typed columns and pads or cuts each row to the columns", () => {
    const table = cleanTable({
      columns: [
        { kind: "stacked", label: "Project" },
        { color: "#12b76a", kind: "tag", label: "Status" },
      ],
      rows: [["Only one"], ["a", "b", "extra"]],
    });
    expect(table?.rows).toEqual([
      ["Only one", ""],
      ["a", "b"],
    ]);
    expect(table?.columns[1]).toEqual({
      color: "#12b76a",
      kind: "tag",
      label: "Status",
    });
  });

  it("drops an unknown cell type and a bad colour", () => {
    const table = cleanTable({
      columns: [{ color: "red", kind: "video", label: "X" }],
      rows: [],
    });
    expect(table?.columns[0]).toEqual({ kind: "text", label: "X" });
  });

  it("has no table without columns", () => {
    expect(cleanTable({ columns: [], rows: [["a"]] })).toBeUndefined();
    expect(cleanTable("table")).toBeUndefined();
  });
});

describe("older tables", () => {
  it("read their column names as text columns with one example row", () => {
    expect(tableOf({ options: ["Project", "Status"], text: "x" })).toEqual({
      columns: [
        { kind: "text", label: "Project" },
        { kind: "text", label: "Status" },
      ],
      rows: [["Example", "Example"]],
    });
  });
});

describe("editing a table", () => {
  it("adds a column with an empty cell in every row, up to the limit", () => {
    const wider = addColumn(DEFAULT_TABLE);
    expect(wider.columns).toHaveLength(4);
    expect(wider.rows.every((row) => row.length === 4)).toBe(true);
    let full = DEFAULT_TABLE;
    for (let i = 0; i < 20; i += 1) {
      full = addColumn(full);
    }
    expect(full.columns).toHaveLength(MAX_TABLE_COLUMNS);
  });

  it("removes a column's cells with it, and keeps the last column", () => {
    const narrower = removeColumn(DEFAULT_TABLE, 0);
    expect(narrower.rows[0]).toEqual(["Active", "Design, Web"]);
    const one = removeColumn(removeColumn(narrower, 0), 0);
    expect(one.columns).toHaveLength(1);
  });

  it("sets one cell, retypes a column, adds and removes rows", () => {
    const edited = setCell(DEFAULT_TABLE, 1, 1, "Done");
    expect(edited.rows[1]?.[1]).toBe("Done");
    expect(edited.rows[0]?.[1]).toBe("Active");
    expect(updateColumn(edited, 2, { kind: "tag" }).columns[2]?.kind).toBe(
      "tag"
    );
    expect(addRow(edited).rows.at(-1)).toEqual(["", "", ""]);
    expect(removeRow(edited, 0).rows).toHaveLength(1);
  });

  it("splits chips on commas and drops empty ones", () => {
    expect(chipsOf("Design, Web,, ")).toEqual(["Design", "Web"]);
  });
});

describe("table borders", () => {
  it("keeps border settings, clamped, and drops a bad line style or colour", () => {
    const table = cleanTable({
      borders: { color: "#ff0000", lines: "grid", outline: true, width: 9 },
      columns: [{ kind: "text", label: "A" }],
      rows: [],
    });
    expect(table?.borders).toEqual({
      color: "#ff0000",
      lines: "grid",
      outline: true,
      width: 4,
    });
    const bad = cleanTable({
      borders: { color: "red", lines: "dotted" },
      columns: [{ kind: "text", label: "A" }],
      rows: [],
    });
    expect(bad?.borders).toEqual({ lines: "rows", outline: false, width: 1 });
  });

  it("starts an older table's border edit from the default look", () => {
    expect(updateBorders(DEFAULT_TABLE, { outline: true }).borders).toEqual({
      lines: "rows",
      outline: true,
      width: 1,
    });
  });
});

describe("review fixes", () => {
  const bordered = updateBorders(DEFAULT_TABLE, {
    lines: "grid",
    outline: true,
  });

  it("keeps the borders when a column is added or removed", () => {
    expect(addColumn(bordered).borders).toEqual(bordered.borders);
    expect(removeColumn(bordered, 0).borders).toEqual(bordered.borders);
  });

  it("folds two-line cells onto one line when the column changes type", () => {
    const flat = setColumnKind(DEFAULT_TABLE, 0, "text");
    expect(flat.rows[0]?.[0]).toBe("Website redesign Acme Co.");
    expect(flat.rows[0]?.[1]).toBe("Active");
  });

  it("keeps an older table's long column name through a save", () => {
    const long = "x".repeat(100);
    expect(
      cleanTable(tableOf({ options: [long], text: "" }))?.columns[0]?.label
    ).toBe(long);
  });
});

describe("icon and button cells, and header colours", () => {
  const heart = [["path", { d: "M1 1h2" }]] as [
    string,
    Record<string, string>,
  ][];
  const base = {
    columns: [
      { color: "#ff0000", kind: "icon", label: "Icon" },
      {
        buttonStyle: "outline",
        color: "#0000ff",
        kind: "button",
        label: "Act",
      },
      { buttonStyle: "outline", kind: "text", label: "Plain" },
    ],
    rows: [["FavouriteIcon", "Open", "x"]],
  };

  it("keeps a button column's style, and only on button columns", () => {
    const table = cleanTable(base);
    expect(table?.columns[1]?.buttonStyle).toBe("outline");
    expect(table?.columns[2]?.buttonStyle).toBeUndefined();
  });

  it("keeps the drawing of each icon a cell names, and drops the rest", () => {
    const table = cleanTable({
      ...base,
      icons: { Bad: [["script", {}]], FavouriteIcon: heart, StaleIcon: heart },
    });
    expect(table?.icons).toEqual({ FavouriteIcon: heart });
  });

  it("keeps header colours as hex only", () => {
    expect(
      cleanTable({ ...base, header: { background: "#f2f4f7", color: "nope" } })
        ?.header
    ).toEqual({ background: "#f2f4f7" });
    expect(
      cleanTable({ ...base, header: { background: "transparent" } })?.header
    ).toBeUndefined();
  });

  it("sets an icon cell with its drawing", () => {
    const table = setIconCell(DEFAULT_TABLE, 0, 0, "FavouriteIcon", heart);
    expect(table.rows[0]?.[0]).toBe("FavouriteIcon");
    expect(table.icons?.FavouriteIcon).toEqual(heart);
    expect(updateHeader(table, { background: "#000000" }).header).toEqual({
      background: "#000000",
    });
  });
});

describe("column order and header None", () => {
  it("moves each column's cells with it", () => {
    const moved = reorderColumns(DEFAULT_TABLE, [2, 0, 1]);
    expect(moved.columns.map((column) => column.label)).toEqual([
      "Tags",
      "Project",
      "Status",
    ]);
    expect(moved.rows[0]).toEqual([
      "Design, Web",
      "Website redesign\nAcme Co.",
      "Active",
    ]);
  });

  it("clears a header colour set to None, so the table's own shows", () => {
    const red = updateHeader(DEFAULT_TABLE, { color: "#ff0000" });
    expect(updateHeader(red, { color: "transparent" }).header).toEqual({});
  });
});

describe("columns that follow kit styles", () => {
  const linked = cleanTable({
    columns: [
      {
        kind: "tag",
        label: "Status",
        look: { background: "#ffffff" },
        styleId: "pill",
      },
      { kind: "text", label: "Name", styleId: "pill" },
    ],
    rows: [["Active", "x"]],
  });

  it("keeps a style link on tag, chip and button columns only", () => {
    expect(linked?.columns[0]?.styleId).toBe("pill");
    expect(linked?.columns[0]?.look).toEqual({ background: "#ffffff" });
    expect(linked?.columns[1]?.styleId).toBeUndefined();
  });

  it("keeps the link from tags to chips, and drops it for another kind", () => {
    const table = linked as NonNullable<typeof linked>;
    expect(setColumnKind(table, 0, "chips").columns[0]?.styleId).toBe("pill");
    expect(setColumnKind(table, 0, "text").columns[0]?.styleId).toBeUndefined();
  });
});
