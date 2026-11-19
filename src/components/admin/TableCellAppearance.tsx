import { useState } from "react";
import type { BrandKitDoc } from "../../../config/brandKit.js";
import { cellLookOf } from "../../../config/conceptStyle.js";
import {
  type ConceptTableColumn,
  cellStyleKinds,
} from "../../../config/conceptTable.js";
import {
  cellColumn,
  type TableCellStyle,
} from "../../../config/tableCellStyles.js";
import { Button } from "../ui/button";
import { ConceptField, ConceptSelect } from "./ConceptControls";
import { ConceptTableCellStyleFields } from "./ConceptTableCellStyleFields";

export function TableCellAppearance({
  brandDoc,
  column,
  row,
  label,
  textColor,
  onChange,
}: {
  brandDoc?: BrandKitDoc | null;
  column: ConceptTableColumn;
  row: number;
  label: string;
  textColor: string;
  onChange: (cell?: TableCellStyle) => void;
}) {
  const [open, setOpen] = useState(false);
  const cell = column.cells?.[row];
  const styles =
    brandDoc?.componentStyles.filter((s) =>
      cellStyleKinds(column.kind).includes(s.kind)
    ) ?? [];
  return (
    <details
      className="review-concepts__cell-style"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary aria-label={`${label} style`}>Cell style</summary>
      {open === true && (
        <div>
          {styles.length > 0 && (
            <ConceptField label="Kit style">
              <ConceptSelect
                label={`${label} kit style`}
                onChange={(id) => {
                  const style = styles.find((s) => s.id === id);
                  onChange({
                    ...cell,
                    look: style && cellLookOf(style.look),
                    styleId: style?.id,
                  });
                }}
                options={[
                  { label: "Use column style", value: "__column" },
                  ...styles.map((s) => ({ label: s.name, value: s.id })),
                ]}
                value={cell?.styleId ?? "__column"}
              />
            </ConceptField>
          )}
          <ConceptTableCellStyleFields
            brandDoc={brandDoc}
            column={cellColumn(column, row)}
            fieldLabel={label}
            onChange={(patch) =>
              onChange({ ...cell, overrides: { ...cell?.overrides, ...patch } })
            }
            textColor={textColor}
          />
          <ConceptTableCellStyleFields
            box
            brandDoc={brandDoc}
            column={{ ...column, look: cell?.box }}
            fieldLabel={`${label} box`}
            onChange={(patch) =>
              onChange({ ...cell, box: { ...cell?.box, ...patch } })
            }
            summary="Cell box"
            textColor={textColor}
          />
          {cell !== undefined && (
            <Button
              onClick={() => onChange()}
              size="xs"
              type="button"
              variant="outline"
            >
              Reset to column
            </Button>
          )}
        </div>
      )}
    </details>
  );
}
