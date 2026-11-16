import { describe, expect, it } from "vitest";
import { componentSource } from "./componentSource.js";
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

describe("componentSource card", () => {
  it("styles the title by class, and keeps it out of a page's headings in the preview", () => {
    const source = componentSource(
      cleanConcept({
        elements: [{ kind: "card", text: "Title\nBody" }],
      }).elements[0] as ReviewConceptElement,
      "Plain"
    );
    expect(source.tsx).toContain(
      '<h3 className="card-plain__title">{title}</h3>'
    );
    expect(source.css).toContain(".card-plain__title {");
    expect(source.preview).not.toContain("<h3");
    expect(source.preview).toContain('role="heading"');
  });
});
