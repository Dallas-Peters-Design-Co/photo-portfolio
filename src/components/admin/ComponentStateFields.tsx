import {
  stateLabel,
  usesNamedStates,
} from "../../../config/componentStates.js";
import { createConceptElement } from "../../../config/conceptDefaults.js";
import type { ConceptSlot } from "../../../config/conceptSlots.js";
import { MAX_SLOT_ELEMENTS } from "../../../config/conceptSlots.js";
import { freshIds } from "../../../config/conceptSteps.js";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ConceptField } from "./ConceptControls";

export function ComponentStateFields({
  group,
  change,
}: {
  group: ConceptSlot;
  change: (patch: Partial<ConceptSlot>) => void;
}) {
  const add = () => {
    const last = group.elements.at(-1);
    const state = last ? freshIds(last) : createConceptElement("text");
    change({
      elements: [
        ...group.elements,
        { ...state, stateName: `State ${group.elements.length + 1}` },
      ],
    });
  };
  return (
    <>
      <Button
        aria-pressed={Boolean(group.stateful)}
        onClick={() =>
          change(
            group.stateful
              ? { disclosureLabel: undefined, stateful: false }
              : {
                  disclosureLabel: group.disclosureLabel || "Cards",
                  stateful: true,
                }
          )
        }
        type="button"
      >
        {group.stateful ? "Use as layout group" : "Make collapsible component"}
      </Button>
      {group.stateful && !usesNamedStates(group) && (
        <Button
          disabled={!group.elements.length}
          onClick={() =>
            change({
              disclosureLabel: undefined,
              elements: group.elements.map((child, i) => ({
                ...child,
                stateName:
                  child.stateName?.trim() ||
                  child.text.split("\n")[0].trim() ||
                  stateLabel(child, i),
              })),
            })
          }
          type="button"
        >
          Use children as separate variants
        </Button>
      )}
      {usesNamedStates(group) ? (
        <>
          {group.elements.map((child, index) => (
            <ConceptField key={child.id} label={`State ${index + 1} name`}>
              <Input
                aria-label={`State ${index + 1} name`}
                maxLength={64}
                onChange={(event) =>
                  change({
                    elements: group.elements.map((el) =>
                      el.id === child.id
                        ? { ...el, stateName: event.target.value }
                        : el
                    ),
                  })
                }
                placeholder={stateLabel(child, index)}
                value={child.stateName ?? ""}
              />
            </ConceptField>
          ))}
          <Button
            disabled={group.elements.length >= MAX_SLOT_ELEMENTS}
            onClick={add}
            type="button"
          >
            Add component state
          </Button>
        </>
      ) : null}
    </>
  );
}
