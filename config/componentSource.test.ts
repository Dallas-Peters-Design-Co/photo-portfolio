import { describe, expect, it } from "vitest";
import { componentSource } from "./componentSource.js";
import { createConceptElement } from "./conceptDefaults.js";
import { tableOf } from "./conceptTable.js";
import { cleanConcept, type ReviewConceptElement } from "./reviewConcept.js";

const element = (raw: Record<string, unknown>) =>
  cleanConcept({ elements: [raw] }).elements[0] as ReviewConceptElement;

describe("componentSource", () => {
  it("names a button style and puts its look in custom properties", () => {
    const source = componentSource(
      element({
        background: "#123456",
        color: "#ffffff",
        kind: "button",
        radius: 8,
        text: "Save",
      }),
      "Primary"
    );
    expect(source.name).toBe("ButtonPrimary");
    expect(source.className).toBe("button-primary");
    expect(source.css).toContain("--button-primary-background: #123456;");
    expect(source.css).toContain("--button-primary-radius: 8px;");
    expect(source.css).toContain(".button-primary:hover");
    expect(source.css).not.toContain("&");
    expect(source.tsx).toContain("<button className=");
    expect(source.tsx).toContain('type="button"');
    expect(source.tsx).toContain('children = "Save"');
    expect(source.preview).toBe(
      '<button className="button-primary" type="button">\n  Save\n</button>'
    );
  });

  it("keeps braces in sample text from being read as code in a preview", () => {
    const source = componentSource(
      element({ kind: "badge", text: "{new}" }),
      "Info"
    );
    expect(source.preview).toContain('{"{"}new{"}"}');
  });

  it("does not repeat the kind when the style's name already starts with it", () => {
    const source = componentSource(element({ kind: "badge" }), "Badge success");
    expect(source.name).toBe("BadgeSuccess");
  });

  it("draws a table with its header and rows", () => {
    const source = componentSource(
      element({
        kind: "table",
        table: {
          columns: [{ kind: "text", label: "Name" }],
          rows: [["Ada"]],
        },
      }),
      "Data"
    );
    expect(source.tsx).toContain('<th scope="col">Name</th>');
    expect(source.tsx).toContain("<td>Ada</td>");
  });
});

describe("componentSource cards, panels and tabs", () => {
  const one = (raw: Record<string, unknown>) =>
    cleanConcept({ elements: [raw] }).elements[0] as ReviewConceptElement;

  it("leads a card with its icon, title and body, as the app does", () => {
    const source = componentSource(
      one({
        iconName: "StarIcon",
        iconSvg: [["path", { d: "M1 1", stroke: "currentColor" }]],
        kind: "card",
        text: "Title\nBody",
      }),
      "Plain"
    );
    expect(source.tsx).toContain(
      '<strong className="card-plain__title">{title}</strong>'
    );
    expect(source.tsx).toContain('<svg className="card-plain__icon"');
    expect(source.css).toContain(".card-plain__title {");
    expect(source.preview).not.toContain("<h3");
    expect(source.preview).toContain(">Title</strong>");
  });

  it("draws a panel's slot elements with their own classes and CSS", () => {
    const source = componentSource(
      one({
        dividers: true,
        kind: "panel",
        slots: {
          footer: {
            elements: [{ background: "#2759cc", kind: "button", text: "Go" }],
            layout: "row",
          },
        },
        text: "Panel title",
      }),
      "Primary"
    );
    expect(source.preview).toContain("data-dividers");
    expect(source.preview).toContain('className="panel-primary__footer-1"');
    expect(source.css).toContain(
      "--panel-primary__footer-1-background: #2759cc;"
    );
    expect(source.preview).not.toContain("@@");
    expect(source.css).not.toContain("@@");
  });

  it("gives tabs their indicator, colours and height, and keeps the open tab", () => {
    const source = componentSource(
      one({
        kind: "tabs",
        options: ["Overview", "Settings"],
        tabLook: {
          activeColor: "#00289d",
          height: 52,
          indicatorColor: "#00289d",
          indicatorSize: 5,
        },
        text: "Overview",
      }),
      "Primary"
    );
    expect(source.css).toContain("--tabs-primary-tab-height: 52px;");
    expect(source.css).toContain("--tabs-primary-tab-indicator-size: 5px;");
    expect(source.css).toContain(
      '.tabs-primary__tab[aria-current="page"]::after'
    );
    expect(source.preview).toContain('aria-current="page">Overview</button>');
    expect(source.tsx).toContain("useState");
  });
});

describe("componentSource names what a screen reader needs named", () => {
  const one = (raw: Record<string, unknown>) =>
    cleanConcept({ elements: [raw] }).elements[0] as ReviewConceptElement;

  it("labels a select and a dialog", () => {
    expect(
      componentSource(one({ kind: "select", placeholder: "Country" }), "A")
        .preview
    ).toContain('aria-label="Country"');
    expect(
      componentSource(one({ kind: "dialog", text: "Delete file?\nBody" }), "A")
        .preview
    ).toContain('aria-label="Delete file?"');
  });
});

describe("a table in the copied code", () => {
  it("clips to its corners, and its kit-styled buttons match the kit's", () => {
    const table = createConceptElement("table");
    const columns = tableOf(table).columns.map((column) =>
      column.kind === "button"
        ? {
            ...column,
            look: {
              background: "#00289d",
              lineHeight: 1.25,
              paddingX: 18,
              paddingY: 11,
            },
            styleId: "kit-button",
          }
        : column
    );
    const { css } = componentSource(
      { ...table, table: { ...tableOf(table), columns } },
      "Primary"
    );
    expect(css).toContain("contain: paint;");
    expect(css).toContain("line-height: 1.25;");
    expect(css).toContain("border: none;");
  });
});
