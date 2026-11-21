import { Plus } from "lucide-react";
import { useState } from "react";
import type { ConceptStyle } from "../../../config/conceptStyle.js";
import { groupKitVariants } from "../../../config/kitVariants.js";
import { kindLabel } from "../../components/admin/ConceptControls";
import { useBrandKits } from "../../hooks/useBrandKits";
import { PageSelect } from "./PageFields";
import { libraryDrag } from "./pageLibraryDrag";

export function PageKitVariants({
  styles,
  disabled,
  onInsert,
}: {
  styles: ConceptStyle[];
  disabled: boolean;
  onInsert: (id: string) => void;
}) {
  const [selected, setSelected] = useState<
    Partial<Record<ConceptStyle["kind"], string>>
  >({});
  const { refresh } = useBrandKits();
  return groupKitVariants(styles).map(({ id: kind, variants }) => {
    const variant =
      variants.find((style) => style.id === selected[kind]) ?? variants[0];
    const label = kindLabel(kind);
    const insertLabel = `Insert ${variant.name} (${label})`;
    return (
      <div className="page-builder__variant" key={kind}>
        <PageSelect
          label={label}
          onChange={(id) =>
            setSelected((previous) => ({ ...previous, [kind]: id }))
          }
          onOpenChange={(open) => {
            if (open) {
              void refresh();
            }
          }}
          options={variants.map((style) => ({
            label: style.name,
            value: style.id,
          }))}
          value={variant.id}
        />
        <button
          {...libraryDrag(variant.id)}
          aria-label={insertLabel}
          className="page-builder__insert"
          disabled={disabled}
          draggable={!disabled}
          onClick={() => onInsert(variant.id)}
          title={insertLabel}
          type="button"
        >
          <Plus aria-hidden size={14} />
        </button>
      </div>
    );
  });
}
