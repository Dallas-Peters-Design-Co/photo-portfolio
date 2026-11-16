import { ClipboardPaste, Plus, Trash2 } from "lucide-react";
import {
  addStepAfter,
  type ConceptStep,
  type EnterAnimation,
  MAX_CONCEPT_STEPS,
  pasteStepsAfter,
  removeStep,
  stepsOf,
  withStep,
} from "../../../config/conceptSteps.js";
import type {
  ReviewConcept,
  ReviewConceptElement,
} from "../../../config/reviewConcept.js";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  ConceptField,
  ConceptSelect,
  kindLabel,
  optionsOf,
} from "./ConceptControls";
import { useCopiedConcept } from "./conceptClipboard";

const NONE = "none";

const ANIMATIONS = optionsOf([
  ["fade", "Fades in"],
  ["rise", "Rises up"],
  ["drop", "Drops down"],
  ["from-right", "Slides in from the right"],
  ["from-left", "Slides in from the left"],
  ["pop", "Pops in"],
]);

/**
 * Every element in the step, nested ones too, named by where they sit:
 * "Panel › Button · Save". Any of them can be clicked, or animate in.
 */
const listed = (
  elements: ReviewConceptElement[],
  path = ""
): { label: string; value: string }[] =>
  elements.flatMap((element) => {
    const text = element.text?.split("\n")[0]?.slice(0, 30);
    const name = `${kindLabel(element.kind)}${text ? ` · ${text}` : ""}`;
    const children = [
      ...Object.values(element.slots ?? {}).flatMap(
        (slot) => slot?.elements ?? []
      ),
      ...(element.group?.elements ?? []),
    ];
    return [
      { label: `${path}${name}`, value: element.id },
      ...listed(children, `${path}${kindLabel(element.kind)} › `),
    ];
  });

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
  const copied = useCopiedConcept();
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
  const everything = listed(step?.elements ?? []);
  const triggers = [
    { label: "None — the viewer presses Next", value: NONE },
    ...everything,
  ];
  const entering = [
    { label: "Nothing animates in", value: NONE },
    ...everything,
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
        {copied && copied.id !== concept.id ? (
          <Button
            disabled={steps.length >= MAX_CONCEPT_STEPS}
            onClick={() => {
              onChange(pasteStepsAfter(concept, index, copied));
              onIndex(index + 1);
            }}
            size="xs"
            title={`Paste ${copied.title || "the copied concept"} after step ${index + 1}`}
            type="button"
            variant="outline"
          >
            <ClipboardPaste size={12} /> Paste as{" "}
            {stepsOf(copied).length === 1 ? "step" : "steps"}
          </Button>
        ) : null}
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
            <ConceptField label="Click to go on">
              <ConceptSelect
                label={`Step ${index + 1}: what to click for the next step`}
                onChange={(value) =>
                  set({ trigger: value === NONE ? undefined : value })
                }
                options={triggers}
                value={step.trigger ?? NONE}
              />
            </ConceptField>
          )}
          <ConceptField label="Animates in">
            <ConceptSelect
              label={`Step ${index + 1}: what animates in`}
              onChange={(value) =>
                set({
                  enter:
                    value === NONE
                      ? undefined
                      : {
                          animation: step.enter?.animation ?? "rise",
                          element: value,
                        },
                })
              }
              options={entering}
              value={step.enter?.element ?? NONE}
            />
          </ConceptField>
          {step.enter ? (
            <ConceptField label="How">
              <ConceptSelect
                label={`Step ${index + 1}: how it animates in`}
                onChange={(value) =>
                  set({
                    enter: {
                      animation: value as EnterAnimation,
                      element: step.enter?.element ?? "",
                    },
                  })
                }
                options={ANIMATIONS}
                value={step.enter.animation}
              />
            </ConceptField>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
