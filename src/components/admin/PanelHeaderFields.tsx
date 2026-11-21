import type { BrandKitDoc } from "../../../config/brandKit.js";
import type { ConceptStyleProp } from "../../../config/conceptStyle.js";
import {
  PANEL_HEADER_STYLE_KEYS,
  type ReviewConceptElement,
} from "../../../config/reviewConcept.js";
import {
  ConceptField,
  ConceptGroup,
  ConceptSelect,
  NumberField,
} from "./ConceptControls";
import { ConceptFontField } from "./ConceptFontField";
import { WEIGHTS } from "./ConceptTypeFields";
import { ConceptColorField } from "./ReviewConceptBrand";

export function PanelHeaderFields({
  brandDoc,
  canEditProp,
  element,
  onChange,
}: {
  brandDoc?: BrandKitDoc | null;
  canEditProp: (key: ConceptStyleProp) => boolean;
  element: ReviewConceptElement;
  onChange: (patch: Partial<ReviewConceptElement>) => void;
}) {
  if (!PANEL_HEADER_STYLE_KEYS.some(canEditProp)) {
    return null;
  }
  const face = element.headerTypeface ?? element;
  return (
    <ConceptGroup compact name="Panel header">
      {canEditProp("headerTypeface") && (
        <ConceptFontField
          brandDoc={brandDoc}
          family={face.fontFamily}
          fontId={face.fontId}
          fontRef={face.fontRef}
          label="Header typeface"
          onChange={(headerTypeface) => onChange({ headerTypeface })}
        />
      )}
      {canEditProp("headerFontSize") && (
        <NumberField
          label="Header font size"
          max={72}
          min={10}
          onChange={(headerFontSize) => onChange({ headerFontSize })}
          value={element.headerFontSize ?? element.fontSize}
        />
      )}
      {canEditProp("headerFontWeight") && (
        <ConceptField label="Header font weight">
          <ConceptSelect
            label="Header font weight"
            onChange={(value) =>
              onChange({
                headerFontWeight: Number(
                  value
                ) as ReviewConceptElement["fontWeight"],
              })
            }
            options={WEIGHTS}
            value={String(element.headerFontWeight ?? 700)}
          />
        </ConceptField>
      )}
      {canEditProp("headerLineHeight") && (
        <NumberField
          label="Header line height"
          max={2.4}
          min={1}
          onChange={(headerLineHeight) => onChange({ headerLineHeight })}
          step={0.05}
          value={element.headerLineHeight ?? element.lineHeight}
        />
      )}
      {canEditProp("headerColor") && (
        <ConceptColorField
          ariaLabel="Header text color"
          brandDoc={brandDoc}
          label="Text"
          onChange={(headerColor) => onChange({ headerColor })}
          value={element.headerColor ?? element.color}
        />
      )}
      {canEditProp("headerBackground") && (
        <ConceptColorField
          allowNone
          ariaLabel="Header fill"
          brandDoc={brandDoc}
          label="Fill"
          onChange={(headerBackground) => onChange({ headerBackground })}
          value={element.headerBackground ?? "transparent"}
        />
      )}
    </ConceptGroup>
  );
}
