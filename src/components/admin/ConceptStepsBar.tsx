import { Plus, Trash2 } from "lucide-react";
import {
  addStepAfter,
  type ConceptStep,
  MAX_CONCEPT_STEPS,
  removeStep,
  stepsOf,
  withStep,
} from "../../../config/conceptSteps.js";
import type { ReviewConcept } from "../../../config/reviewConcept.js";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ConceptSelect, kindLabel } from "./ConceptControls";

const NO_TRIGGER = "none";

/**
 * A concept's steps, for showing a sequence of events: pick the step to edit,
 * add one after it (a copy, since the next screen is usually this one with
 * one thing changed), say what happens in it, and choose the element whose
 * click moves on. A concept with one step is a single screen, as before.
 */
export function ConceptStepsBar({
  concept,
  index,
  onChange,
  onIndex,
}: {
  concept: ReviewConcept;
  index: number;
  onChange: (next: ReviewConcept) => void;
  onIndex: (index: number) => void;
}) {
  const steps = stepsOf(concept);
  const step = steps[index];
  const last = index === steps.length - 1;
  const set = (patch: Partial<ConceptStep>) => {
    if (step) {
      onChange(withStep(concept, index, { ...step, ...patch }));
    }
  };
  const add = () => {
    onChange(addStepAfter(concept, index));
    onIndex(index + 1);
  };
  const triggers = [
    { label: "None — the viewer presses Next", value: NO_TRIGGER },
    ...(step?.elements ?? []).map((element) => ({
      label: `${kindLabel(element.kind)}${
        element.text ? ` · ${element.text.split("\n")[0]?.slice(0, 30)}` : ""
      }`,
      value: element.id,
    })),
  ];

  return (
    <div className="concept-steps">
      <div aria-label="Steps" className="concept-steps__list" role="tablist">
        {steps.map((s, i) => (
          <button
            aria-selected={i === index}
            className="concept-steps__tab"
            key={s.id}
            onClick={() => onIndex(i)}
            role="tab"
            title={s.caption || `Step ${i + 1}`}
            type="button"
          >
            {i + 1}
          </button>
        ))}
        <Button
          disabled={steps.length >= MAX_CONCEPT_STEPS}
          onClick={add}
          size="xs"
          type="button"
          variant="outline"
        >
          <Plus size={12} />{" "}
          {steps.length === 1 ? "Make it a sequence" : "Add step"}
        </Button>
        {index > 0 ? (
          <Button
            aria-label={`Remove step ${index + 1}`}
            onClick={() => {
              onChange(removeStep(concept, index));
              onIndex(index - 1);
            }}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <Trash2 size={13} />
          </Button>
        ) : null}
      </div>
      {steps.length > 1 && step ? (
        <div className="concept-steps__fields">
          <Input
            aria-label={`Step ${index + 1} caption`}
            onChange={(event) => set({ caption: event.target.value })}
            placeholder={
              index === 0
                ? "e.g. The page before anything happens"
                : "e.g. Clicks Upload"
            }
            size="sm"
            value={step.caption}
          />
          {last ? (
            <span className="concept-steps__note">
              The last step: the viewer can start over from here.
            </span>
          ) : (
            <ConceptSelect
              label={`Step ${index + 1}: what to click for the next step`}
              onChange={(value) =>
                set({ trigger: value === NO_TRIGGER ? undefined : value })
              }
              options={triggers}
              value={step.trigger ?? NO_TRIGGER}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
