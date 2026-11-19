import type { BrandKitDoc } from "../../../config/brandKit.js";
import type {
  ConceptCellLook,
  ConceptTableColumn,
} from "../../../config/conceptTable.js";
import { NumberField } from "./ConceptControls";
import { ConceptColorField } from "./ReviewConceptBrand";

/** The appearance of the content in one column's cells. */
export function ConceptTableCellStyleFields({
  brandDoc,
  column,
  fieldLabel,
  summary = "Cell item style",
  box = false,
  onChange,
  textColor,
}: {
  brandDoc?: BrandKitDoc | null;
  column: ConceptTableColumn;
  fieldLabel: string;
  summary?: string;
  box?: boolean;
  onChange: (look: ConceptCellLook) => void;
  textColor: string;
}) {
  const look = column.look ?? {};
  const set = onChange;
  const boxed = box || column.kind !== "icon";
  return (
    <details className="review-concepts__cell-style">
      <summary>{summary}</summary>
      <div className="review-concepts__cell-style-fields">
        <ConceptColorField
          ariaLabel={`${fieldLabel} item text color`}
          brandDoc={brandDoc}
          label="Text"
          onChange={(color) => set({ color })}
          value={look.color ?? column.color ?? textColor}
        />
        <NumberField
          label="Text size"
          max={72}
          min={8}
          onChange={(fontSize) => set({ fontSize })}
          value={look.fontSize ?? 14}
        />
        <NumberField
          label="Text weight"
          max={900}
          min={100}
          onChange={(fontWeight) => set({ fontWeight })}
          value={look.fontWeight ?? 400}
        />
        {!box && column.kind === "progress" && (
          <>
            <ConceptColorField
              ariaLabel={`${fieldLabel} progress fill`}
              brandDoc={brandDoc}
              label="Bar fill"
              onChange={(accentColor) => set({ accentColor })}
              value={look.accentColor ?? look.color ?? textColor}
            />
            <NumberField
              label="Bar height"
              max={24}
              min={2}
              onChange={(barHeight) => set({ barHeight })}
              value={look.barHeight ?? 6}
            />
            <label>
              <input
                checked={look.showValue !== false}
                onChange={(event) => set({ showValue: event.target.checked })}
                type="checkbox"
              />{" "}
              Show percentage
            </label>
          </>
        )}
        {boxed ? (
          <>
            <ConceptColorField
              allowNone
              ariaLabel={`${fieldLabel} item fill`}
              brandDoc={brandDoc}
              label={!box && column.kind === "progress" ? "Track" : "Fill"}
              onChange={(background) => set({ background })}
              value={look.background ?? "transparent"}
            />
            <ConceptColorField
              allowNone
              ariaLabel={`${fieldLabel} item border`}
              brandDoc={brandDoc}
              label="Border"
              onChange={(borderColor) => set({ borderColor })}
              value={look.borderColor ?? "transparent"}
            />
            <NumberField
              label="Border width"
              max={8}
              onChange={(borderWidth) => set({ borderWidth })}
              value={look.borderWidth ?? 1}
            />
            <NumberField
              label="Radius"
              max={999}
              onChange={(radius) => set({ radius })}
              value={look.radius ?? 6}
            />
            <NumberField
              label="Padding X"
              onChange={(paddingX) => set({ paddingX })}
              value={look.paddingX ?? 12}
            />
            <NumberField
              label="Padding Y"
              onChange={(paddingY) => set({ paddingY })}
              value={look.paddingY ?? 4}
            />
          </>
        ) : null}
      </div>
    </details>
  );
}
