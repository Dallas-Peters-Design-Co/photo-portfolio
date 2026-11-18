import { useId } from "react";
import type { BrandKitDoc } from "../../../config/brandKit.js";
import {
  cleanTooltip,
  TOOLTIP_SIDES,
  type TooltipSide,
} from "../../../config/conceptTooltip.js";
import type { ReviewConceptElement } from "../../../config/reviewConcept.js";
import { Checkbox } from "../../components/ui/checkbox";
import { Input } from "../../components/ui/input";
import { PageField, PageSelect } from "./PageFields";

export function PageTooltipFields({
  doc,
  element,
  onChange,
}: {
  doc?: BrandKitDoc | null;
  element: ReviewConceptElement;
  onChange: (patch: Partial<ReviewConceptElement>) => void;
}) {
  const { tooltip } = element;
  const enabledId = useId();
  const interactiveId = useId();
  const styles = (doc?.componentStyles ?? []).filter(
    (style) => style.kind === "tooltip"
  );
  const set = (patch: Partial<NonNullable<typeof tooltip>>) => {
    if (tooltip) {
      onChange({ tooltip: { ...tooltip, ...patch } });
    }
  };
  return (
    <>
      <h2>Tooltip</h2>
      <label htmlFor={enabledId}>
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
        />{" "}
        Add tooltip
      </label>
      {tooltip ? (
        <>
          <PageField label="Text">
            <Input
              aria-label="Tooltip text"
              onChange={(event) => set({ text: event.target.value })}
              size="sm"
              tone="board"
              value={tooltip.text}
            />
          </PageField>
          <PageSelect
            label="Tooltip position"
            onChange={(side) => set({ side: side as TooltipSide })}
            options={TOOLTIP_SIDES.map((side) => ({
              label: side,
              value: side,
            }))}
            value={tooltip.side}
          />
          {styles.length ? (
            <PageSelect
              label="Tooltip kit style"
              onChange={(id) => {
                const style = styles.find((item) => item.id === id);
                onChange({
                  tooltip: cleanTooltip({
                    ...tooltip,
                    look: style
                      ? { ...tooltip.look, ...style.look }
                      : tooltip.look,
                    styleId: style?.id,
                  }),
                });
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
          ) : null}
          <label htmlFor={interactiveId}>
            <Checkbox
              checked={tooltip.interactive}
              id={interactiveId}
              onChange={(event) => set({ interactive: event.target.checked })}
            />{" "}
            Interactive on hover or focus
          </label>
        </>
      ) : null}
    </>
  );
}
