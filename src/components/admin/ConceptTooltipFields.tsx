import { useId } from "react";
import type { BrandKitDoc } from "../../../config/brandKit.js";
import {
  cleanTooltip,
  TOOLTIP_SIDES,
  type TooltipSide,
} from "../../../config/conceptTooltip.js";
import type { ReviewConceptElement } from "../../../config/reviewConcept.js";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { ConceptField, ConceptGroup, ConceptSelect } from "./ConceptControls";

export function ConceptTooltipFields({
  brandDoc,
  element,
  onChange,
}: {
  brandDoc?: BrandKitDoc | null;
  element: ReviewConceptElement;
  onChange: (patch: Partial<ReviewConceptElement>) => void;
}) {
  const { tooltip } = element;
  const enabledId = useId();
  const interactiveId = useId();
  const styles = (brandDoc?.componentStyles ?? []).filter(
    (style) => style.kind === "tooltip"
  );
  const set = (patch: Partial<NonNullable<typeof tooltip>>) => {
    if (tooltip) {
      onChange({ tooltip: { ...tooltip, ...patch } });
    }
  };
  return (
    <ConceptGroup name="Tooltip">
      <label className="review-concepts__check" htmlFor={enabledId}>
        <Checkbox
          checked={Boolean(tooltip)}
          id={enabledId}
          onChange={(event) =>
            onChange({
              tooltip: event.target.checked
                ? cleanTooltip({ text: "Helpful information" })
                : undefined,
            })
          }
        />
        <span>Add tooltip</span>
      </label>
      {tooltip ? (
        <>
          <ConceptField label="Text" wide>
            <Input
              aria-label="Tooltip text"
              onChange={(event) => set({ text: event.target.value })}
              size="sm"
              value={tooltip.text}
            />
          </ConceptField>
          <ConceptField label="Position">
            <ConceptSelect
              label="Tooltip position"
              onChange={(side) => set({ side: side as TooltipSide })}
              options={TOOLTIP_SIDES.map((side) => ({
                label: side[0]?.toUpperCase() + side.slice(1),
                value: side,
              }))}
              value={tooltip.side}
            />
          </ConceptField>
          {styles.length > 0 ? (
            <ConceptField label="Kit style">
              <ConceptSelect
                label="Tooltip kit style"
                onChange={(id) => {
                  const style = styles.find((item) => item.id === id);
                  const next = cleanTooltip({
                    ...tooltip,
                    look: style
                      ? { ...tooltip.look, ...style.look }
                      : tooltip.look,
                    styleId: style?.id,
                  });
                  onChange({ tooltip: next });
                }}
                options={[
                  { label: "Default", value: "default" },
                  ...styles.map((style) => ({
                    label: style.name,
                    value: style.id,
                  })),
                ]}
                value={tooltip.styleId ?? "default"}
              />
            </ConceptField>
          ) : null}
          <label className="review-concepts__check" htmlFor={interactiveId}>
            <Checkbox
              checked={tooltip.interactive}
              id={interactiveId}
              onChange={(event) => set({ interactive: event.target.checked })}
            />
            <span>Interactive on hover or focus</span>
          </label>
        </>
      ) : null}
    </ConceptGroup>
  );
}
