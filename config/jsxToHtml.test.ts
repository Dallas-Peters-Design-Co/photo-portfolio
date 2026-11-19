import { describe, expect, it } from "vitest";
import { componentSource } from "./componentSource.js";
import { jsxToHtml } from "./jsxToHtml.js";
import { cleanConcept, type ReviewConceptElement } from "./reviewConcept.js";

describe("jsxToHtml", () => {
  it("writes classes, literal attributes, booleans and style objects as HTML", () => {
    expect(
      jsxToHtml(
        '<div className="a" data-led aria-level={3} hidden={false} style={{ gap: 8, padding: "1px 2px" }}>Hi {"{"}x{"}"}</div>'
      )
    ).toBe(
      '<div class="a" data-led aria-level="3" style="gap: 8px; padding: 1px 2px">Hi {x}</div>'
    );
  });

  it("reads an avatar image and escapes literal strings in attributes and text", () => {
    const element = cleanConcept({
      elements: [
        {
          avatarUrl: "https://example.com/image.png?x=1&y=2",
          kind: "avatar",
          text: "DP",
        },
      ],
    }).elements[0] as ReviewConceptElement;
    const html = jsxToHtml(componentSource(element, "Primary").preview);
    expect(html).toContain(
      '<img src="https://example.com/image.png?x=1&amp;y=2" alt='
    );
    expect(jsxToHtml('<span title={"a} <b>"}>{"<tag>"}</span>')).toBe(
      '<span title="a} &lt;b&gt;">&lt;tag&gt;</span>'
    );
  });

  it("closes SVG shapes and keeps void elements void", () => {
    expect(
      jsxToHtml(
        '<svg viewBox="0 0 24 24"><path d="M1 1" strokeWidth="2" /><path d="M2 2" /></svg><input type="checkbox" defaultChecked />'
      )
    ).toBe(
      '<svg viewBox="0 0 24 24"><path d="M1 1" stroke-width="2" /><path d="M2 2" /></svg><input type="checkbox" checked>'
    );
  });

  it("reads every preview the generator writes", () => {
    const kinds = [
      "avatar",
      "button",
      "card",
      "panel",
      "tabs",
      "table",
      "progress",
      "checkbox",
      "select",
      "textarea",
      "menu",
      "toast",
    ];
    for (const kind of kinds) {
      const element = cleanConcept({ elements: [{ kind, text: "A < B" }] })
        .elements[0] as ReviewConceptElement;
      const html = jsxToHtml(componentSource(element, "Primary").preview);
      expect(html).toContain(`class="${kind}-primary`);
      expect(html).not.toContain("className");
    }
  });
});
