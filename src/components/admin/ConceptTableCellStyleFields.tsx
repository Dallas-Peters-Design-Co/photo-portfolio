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
  index,
  onChange,
  textColor,
}: {
  brandDoc?: BrandKitDoc | null;
  column: ConceptTableColumn;
  index: number;
  onChange: (look: ConceptCellLook) => void;
  textColor: string;
}) {
  const look = column.look ?? {};
  const set = (patch: Partial<ConceptCellLook>) =>
    onChange({ ...look, ...patch });
  const boxed = ["tag", "chips", "button"].includes(column.kind);
  return (
    <details className="review-concepts__cell-style">
      <summary>Cell item style</summary>
      <div className="review-concepts__cell-style-fields">
        <ConceptColorField
          ariaLabel={`Column ${index + 1} item text color`}
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
        {boxed ? (
          <>
            <ConceptColorField
              allowNone
              ariaLabel={`Column ${index + 1} item fill`}
              brandDoc={brandDoc}
              label="Fill"
              onChange={(background) => set({ background })}
              value={look.background ?? "transparent"}
            />
            <ConceptColorField
              allowNone
              ariaLabel={`Column ${index + 1} item border`}
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
              max={48}
              onChange={(paddingX) => set({ paddingX })}
              value={look.paddingX ?? 12}
            />
            <NumberField
              label="Padding Y"
              max={32}
              onChange={(paddingY) => set({ paddingY })}
              value={look.paddingY ?? 4}
            />
          </>
        ) : null}
      </div>
    </details>
  );
}
