import { type ReactNode, useState } from "react";
import {
  initialState,
  stateNames,
  usesNamedStates,
} from "../../../config/componentStates.js";
import {
  type ConceptSlot,
  everyElement,
} from "../../../config/conceptSlots.js";
import type { ReviewConceptElement } from "../../../config/reviewConcept.js";
import { useSequenceMarks } from "./conceptSequence";

export function ComponentStateView({
  group,
  draw,
}: {
  group: ConceptSlot;
  draw: (elements: ReviewConceptElement[]) => ReactNode;
}) {
  const { selected } = useSequenceMarks();
  const [choice, setChoice] = useState<{
    index: number;
    selection?: string | null;
  } | null>(null);
  const named = usesNamedStates(group);
  const names = stateNames(group);
  const selectedIndex = group.elements.findIndex(
    (state) =>
      selected && everyElement([state]).some((el) => el.id === selected)
  );
  let active = initialState(group);
  if (selectedIndex >= 0 && named) {
    active = selectedIndex;
  }
  if (choice && choice.selection === selected && choice.index < names.length) {
    active = choice.index;
  }
  let { elements } = group;
  if (named) {
    elements = elements.slice(active, active + 1);
  } else if (active === 1) {
    elements = [];
  }
  return (
    <div className="concept-states">
      <select
        aria-label="Component state"
        className="concept-states__selector"
        onChange={(event) =>
          setChoice({ index: Number(event.target.value), selection: selected })
        }
        onClick={(event) => event.stopPropagation()}
        value={active}
      >
        {names.map((name, index) => (
          <option key={group.elements[index]?.id ?? name} value={index}>
            {name}
          </option>
        ))}
      </select>
      {elements.length > 0 && draw(elements)}
    </div>
  );
}
