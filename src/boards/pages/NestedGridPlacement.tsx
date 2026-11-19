import {
  cleanGridPlacement,
  type GridPlacement,
  gridFields,
} from "../../../config/conceptGridItem.js";
import { SLOT_DEFAULTS } from "../../../config/conceptSlots.js";
import type { ReviewConceptElement } from "../../../config/reviewConcept.js";
import { Input } from "../../components/ui/input";
import { PageField } from "./PageFields";

export function NestedGridPlacement({
  element,
  layers,
  save,
}: {
  element: ReviewConceptElement;
  layers: ReviewConceptElement[];
  save: (value: GridPlacement | undefined) => void;
}) {
  const parent = layers
    .flatMap((layer) => [layer.group, ...Object.values(layer.slots ?? {})])
    .find((slot) => slot?.elements.some((child) => child.id === element.id));
  if (parent?.layout !== "grid") {
    return null;
  }
  const columns = parent.columns ?? SLOT_DEFAULTS.columns;
  const cell = element.gridPlacement ?? {};
  return (
    <div className="page-builder__numbers">
      {(Object.keys(gridFields) as (keyof GridPlacement)[]).map((key) => {
        const max = key.startsWith("column") ? columns : 256;
        return (
          <PageField key={key} label={gridFields[key]}>
            <Input
              aria-label={gridFields[key]}
              face="numeric"
              max={max}
              min={1}
              onChange={(event) =>
                save(
                  cleanGridPlacement({
                    ...cell,
                    [key]: Math.min(max, event.target.valueAsNumber),
                  }).gridPlacement
                )
              }
              placeholder={key.endsWith("Span") ? "1" : "Auto"}
              size="sm"
              tone="board"
              type="number"
              value={cell[key] ?? ""}
            />
          </PageField>
        );
      })}
    </div>
  );
}
