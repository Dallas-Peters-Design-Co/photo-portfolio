import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import "../../index.css";
import "../../pages/ReviewPage.css";
import "../admin/ReviewConceptsEditor.css";
import "../brandGuide/BrandGuide.css";
import { type BrandKitDoc, EMPTY_KIT } from "../../../config/brandKit.js";
import { SHADOW_PRESETS } from "../../../config/conceptShadow.js";
import {
  applyConceptStyles,
  type ConceptStyle,
  linkStyle,
} from "../../../config/conceptStyle.js";
import {
  createConcept,
  createConceptElement,
  styleSample,
} from "../admin/ReviewConceptBrand";
import { ReviewConceptsEditor } from "../admin/ReviewConceptsEditor";
import { ReviewConceptElementView } from "./ReviewConceptElementView";
import { ReviewConceptPreview } from "./ReviewConceptPreview";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * One kit style looks the same wherever it is drawn: the brand kit's
 * sample, the editor's live preview, and the public review page, each with
 * its own stylesheets around it.
 */

const STYLES: ConceptStyle[] = [
  {
    id: "btn",
    kind: "button",
    look: {
      background: "#3538cd",
      borderColor: "#1f2390",
      borderWidth: 2,
      color: "#ffffff",
      fontFamily: "sans",
      fontSize: 15,
      fontWeight: 600,
      lineHeight: 1.3,
      paddingX: 20,
      paddingY: 10,
      radius: 8,
      shadow: SHADOW_PRESETS.strong,
    },
    name: "Primary",
  },
  {
    id: "pill",
    kind: "badge",
    look: {
      background: "#ecfdf3",
      borderColor: "#abefc6",
      borderWidth: 1,
      color: "#067647",
      fontFamily: "serif",
      fontSize: 12,
      fontWeight: 500,
      lineHeight: 1.4,
      paddingX: 10,
      paddingY: 3,
      radius: 999,
    },
    name: "Success",
  },
  {
    id: "stat",
    kind: "card",
    look: {
      background: "#ffffff",
      borderColor: "#e4e7ec",
      borderWidth: 1,
      color: "#101828",
      fontFamily: "sans",
      fontSize: 20,
      fontWeight: 700,
      lineHeight: 1.2,
      paddingX: 24,
      paddingY: 20,
      radius: 12,
      shadow: SHADOW_PRESETS.soft,
    },
    name: "Stat",
  },
  {
    id: "field",
    kind: "input",
    look: {
      background: "#ffffff",
      borderColor: "#d0d5dd",
      borderWidth: 1,
      color: "#101828",
      fontFamily: "mono",
      fontSize: 14,
      fontWeight: 400,
      lineHeight: 1.4,
      paddingX: 14,
      paddingY: 10,
      radius: 8,
    },
    name: "Default",
  },
  {
    id: "agree",
    kind: "checkbox",
    look: {
      accentColor: "#3538cd",
      background: "transparent",
      checkSize: 20,
      color: "#344054",
      fontFamily: "sans",
      fontSize: 14,
      fontWeight: 500,
      lineHeight: 1.4,
      paddingX: 0,
      paddingY: 0,
      radius: 0,
    },
    name: "Default",
  },
  {
    id: "menu",
    kind: "select",
    look: {
      background: "#ffffff",
      borderColor: "#d0d5dd",
      borderWidth: 1,
      color: "#101828",
      fontFamily: "sans",
      fontSize: 14,
      fontWeight: 400,
      lineHeight: 1.4,
      paddingX: 12,
      paddingY: 8,
      radius: 6,
      shadow: SHADOW_PRESETS.soft,
    },
    name: "Default",
  },
  {
    id: "saved",
    kind: "toast",
    look: {
      accentColor: "#3538cd",
      background: "#101828",
      color: "#ffffff",
      fontFamily: "sans",
      fontSize: 14,
      fontWeight: 500,
      lineHeight: 1.4,
      paddingX: 16,
      paddingY: 12,
      radius: 10,
    },
    name: "Dark",
  },
];

const KIT: BrandKitDoc = { ...EMPTY_KIT, componentStyles: STYLES };

const PROPS = [
  "backgroundColor",
  "color",
  "borderTopWidth",
  "borderTopStyle",
  "borderTopColor",
  "borderTopLeftRadius",
  "boxShadow",
  "paddingTop",
  "paddingLeft",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "textTransform",
] as const;

/** The element a style draws on: the box itself, under any hover wrapper. */
const BOX = {
  badge: "span[style]",
  button: "button",
  card: "article",
  checkbox: "label",
  input: "input",
  select: '[data-slot="select-trigger"]',
  toast: ".concept-toast",
} as const;

const read = (root: Element, kind: keyof typeof BOX) => {
  const box = root.querySelector(BOX[kind]) as HTMLElement;
  const css = getComputedStyle(box);
  return Object.fromEntries(PROPS.map((p) => [p, css[p]]));
};

const mount = (node: React.ReactNode) => {
  const host = document.createElement("div");
  host.style.width = "720px";
  document.body.append(host);
  act(() => createRoot(host).render(node));
  return host;
};

const conceptOf = (styles: ConceptStyle[]) => ({
  ...createConcept(),
  background: "#f9fafb",
  color: "#344054",
  elements: styles.map((style) =>
    linkStyle(createConceptElement(style.kind, KIT), style)
  ),
});

describe("a kit style draws the same everywhere", () => {
  for (const style of STYLES) {
    it(`${style.kind} / ${style.name}`, () => {
      const kind = style.kind as keyof typeof BOX;
      const kit = mount(
        <div className="brand-kit-components__sample concept-canvas">
          <ReviewConceptElementView element={styleSample(style, KIT)} />
        </div>
      );
      const editor = mount(
        <ReviewConceptsEditor
          brandDoc={KIT}
          concepts={[conceptOf([style])]}
          onChange={() => undefined}
        />
      );
      const [published] = applyConceptStyles([conceptOf([style])], STYLES);
      const page = mount(
        <div className="page doc-shell review-page">
          <ReviewConceptPreview concept={published as never} />
        </div>
      );
      const guide = mount(
        <div className="guide-component__sample concept-canvas">
          <ReviewConceptElementView element={styleSample(style, KIT)} />
        </div>
      );
      const inKit = read(kit, kind);
      const inGuide = read(guide, kind);
      const inEditor = read(
        editor.querySelector(".review-concepts__preview") as Element,
        kind
      );
      const onPage = read(
        page.querySelector(".review-page__concept-preview") as Element,
        kind
      );
      expect({ editor: inEditor, guide: inGuide, page: onPage }).toEqual({
        editor: inKit,
        guide: inKit,
        page: inKit,
      });
      for (const host of [kit, editor, page, guide]) {
        host.remove();
      }
    });
  }
});
