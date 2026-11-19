import { type ReactNode, useState } from "react";
import { stateLabel } from "../../../config/componentStates.js";
import { everyElement } from "../../../config/conceptSlots.js";
import type { ReviewConceptElement } from "../../../config/reviewConcept.js";
import { useSequenceMarks } from "./conceptSequence";

export function ComponentStateView({
  states,
  draw,
}: {
  states: ReviewConceptElement[];
  draw: (el: ReviewConceptElement) => ReactNode;
}) {
  const [choice, setChoice] = useState<string | null>(null);
  const { selected } = useSequenceMarks();
  const editing =
    selected &&
    states.find((state) =>
      everyElement([state]).some((el) => el.id === selected)
    );
  const active = editing || states.find((el) => el.id === choice) || states[0];
  if (!active) {
    return null;
  }
  return (
    <div className="concept-states">
      <fieldset
        aria-label="Component states"
        className="concept-states__choices"
      >
        {states.map((state, i) => (
          <button
            aria-pressed={active.id === state.id}
            key={state.id}
            onClick={(e) => {
              e.stopPropagation();
              setChoice(state.id);
            }}
            type="button"
          >
            {stateLabel(state, i)}
          </button>
        ))}
      </fieldset>
      {draw(active)}
    </div>
  );
}
