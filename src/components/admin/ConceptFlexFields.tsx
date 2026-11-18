import { useId } from "react";
import type { ConceptFlex } from "../../../config/conceptFlex.js";
import { Checkbox } from "../ui/checkbox";
import { ConceptGroup, NumberField } from "./ConceptControls";

export function ConceptFlexFields({
  flex,
  onChange,
  grow = 0,
  shrink = 1,
}: {
  flex?: ConceptFlex;
  grow?: number;
  shrink?: number;
  onChange: (next: ConceptFlex | undefined) => void;
}) {
  const enableId = useId();
  const basisId = useId();
  return (
    <ConceptGroup name="Flex sizing">
      <label className="review-concepts__check" htmlFor={enableId}>
        <Checkbox
          checked={Boolean(flex)}
          id={enableId}
          onChange={(event) =>
            onChange(event.target.checked ? { grow, shrink } : undefined)
          }
        />
        Customize flex sizing
      </label>
      {flex ? (
        <>
          <NumberField
            label="Grow"
            max={100}
            onChange={(value) => onChange({ ...flex, grow: value })}
            value={flex.grow}
          />
          <NumberField
            label="Shrink"
            max={100}
            onChange={(value) => onChange({ ...flex, shrink: value })}
            value={flex.shrink}
          />
          <label className="review-concepts__check" htmlFor={basisId}>
            <Checkbox
              checked={flex.basis === undefined}
              id={basisId}
              onChange={(event) =>
                onChange({
                  ...flex,
                  basis: event.target.checked ? undefined : 0,
                })
              }
            />
            Auto basis
          </label>
          {flex.basis === undefined ? null : (
            <NumberField
              label="Basis (px)"
              max={12_000}
              onChange={(value) => onChange({ ...flex, basis: value })}
              value={flex.basis}
            />
          )}
        </>
      ) : null}
    </ConceptGroup>
  );
}
