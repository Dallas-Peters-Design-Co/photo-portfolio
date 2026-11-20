import { useId } from "react";
import type { GridPlacement } from "../../../config/conceptGridItem.js";
import { Checkbox } from "../ui/checkbox";
import { ConceptGroup, NumberField } from "./ConceptControls";

/** A child item's explicit position when its parent uses a grid layout. */
export function ConceptGridItemFields({
  columns,
  placement,
  onChange,
}: {
  columns: number;
  placement?: GridPlacement;
  onChange: (placement: GridPlacement | undefined) => void;
}) {
  const id = useId();
  return (
    <ConceptGroup compact name="Grid position">
      <label className="review-concepts__check" htmlFor={id}>
        <Checkbox
          checked={Boolean(placement)}
          id={id}
          onChange={(event) =>
            onChange(
              event.target.checked
                ? { column: 1, columnSpan: 1, row: 1, rowSpan: 1 }
                : undefined
            )
          }
        />
        Customize position and span
      </label>
      {placement ? (
        <>
          <NumberField
            label="Column"
            max={columns}
            min={1}
            onChange={(column) => onChange({ ...placement, column })}
            value={placement.column ?? 1}
          />
          <NumberField
            label="Row"
            max={256}
            min={1}
            onChange={(row) => onChange({ ...placement, row })}
            value={placement.row ?? 1}
          />
          <NumberField
            label="Column span"
            max={columns}
            min={1}
            onChange={(columnSpan) => onChange({ ...placement, columnSpan })}
            value={placement.columnSpan ?? 1}
          />
          <NumberField
            label="Row span"
            max={256}
            min={1}
            onChange={(rowSpan) => onChange({ ...placement, rowSpan })}
            value={placement.rowSpan ?? 1}
          />
        </>
      ) : null}
    </ConceptGroup>
  );
}
