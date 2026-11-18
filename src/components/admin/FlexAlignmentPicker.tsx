import { useId } from "react";
import type { ConceptSlot } from "../../../config/conceptSlots.js";
import { Checkbox } from "../ui/checkbox";

const POSITIONS = ["start", "center", "end"] as const;
const HORIZONTAL = { center: "center", end: "right", start: "left" };
const VERTICAL = { center: "middle", end: "bottom", start: "top" };

export function FlexAlignmentPicker({
  label,
  layout,
  slot,
  onChange,
}: {
  label: string;
  layout: "row" | "column";
  slot: ConceptSlot;
  onChange: (patch: Partial<ConceptSlot>) => void;
}) {
  const stretchId = useId();
  const betweenId = useId();
  const row = layout === "row";
  const align = slot.align ?? (row ? "center" : "start");
  const justify = slot.justify ?? "start";
  return (
    <fieldset className="concept-alignment">
      <legend>Alignment</legend>
      <div className="concept-alignment__controls">
        <div className="concept-alignment__grid">
          {POSITIONS.flatMap((y) =>
            POSITIONS.map((x) => {
              const cross = row ? y : x;
              const main = row ? x : y;
              const position = `${VERTICAL[y]} ${HORIZONTAL[x]}`;
              return (
                <button
                  aria-label={`${label}: ${position}`}
                  aria-pressed={align === cross && justify === main}
                  key={position}
                  onClick={() => onChange({ align: cross, justify: main })}
                  title={position}
                  type="button"
                />
              );
            })
          )}
        </div>
        <div className="concept-alignment__modes">
          <label className="review-concepts__check" htmlFor={stretchId}>
            <Checkbox
              checked={align === "stretch"}
              id={stretchId}
              onChange={(e) =>
                onChange({ align: e.target.checked ? "stretch" : "start" })
              }
            />
            Stretch
          </label>
          <label className="review-concepts__check" htmlFor={betweenId}>
            <Checkbox
              checked={justify === "between"}
              id={betweenId}
              onChange={(e) =>
                onChange({ justify: e.target.checked ? "between" : "start" })
              }
            />
            Space between
          </label>
        </div>
      </div>
    </fieldset>
  );
}
