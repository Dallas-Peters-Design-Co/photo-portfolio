import { newItemId } from "./proposal.js";
import type { ReviewConcept, ReviewConceptElement } from "./reviewConcept.js";

/**
 * A concept as a sequence of steps: what the screen shows, then what it shows
 * after the viewer does something — click Upload, a toast appears, a file is
 * picked, a field asks for its description.
 *
 * Step one is the concept's own `elements` (with `stepCaption` and
 * `stepTrigger`), so a concept with no steps is unchanged and everything that
 * reads `elements` keeps working. Later steps are `steps`, each a full set of
 * elements, not a diff: a step is what the screen looks like then.
 *
 * Each step may name its trigger, the element whose click moves on. On the
 * review page the viewer clicks that element in the mock-up itself.
 */

export interface ConceptStep {
  /** What the viewer does or sees at this step: "Clicks Upload". */
  caption: string;
  elements: ReviewConceptElement[];
  id: string;
  /** The element in this step whose click shows the next step. */
  trigger?: string;
}

export const MAX_CONCEPT_STEPS = 12;
export const MAX_STEP_CAPTION = 160;

/** Every step, the concept's own elements first. */
export const stepsOf = (concept: ReviewConcept): ConceptStep[] => [
  {
    caption: concept.stepCaption ?? "",
    elements: concept.elements,
    id: `${concept.id}-1`,
    ...(concept.stepTrigger ? { trigger: concept.stepTrigger } : {}),
  },
  ...(concept.steps ?? []),
];

/** The concept with step `index` replaced (step 0 is the concept's own). */
export const withStep = (
  concept: ReviewConcept,
  index: number,
  step: ConceptStep
): ReviewConcept => {
  if (index === 0) {
    const { stepTrigger: _t, ...rest } = concept;
    return {
      ...rest,
      elements: step.elements,
      stepCaption: step.caption,
      ...(step.trigger ? { stepTrigger: step.trigger } : {}),
    };
  }
  return {
    ...concept,
    steps: (concept.steps ?? []).map((s, i) => (i === index - 1 ? step : s)),
  };
};

/** A copy of an element and everything in its slots, with new ids. */
export const freshIds = (
  element: ReviewConceptElement
): ReviewConceptElement => ({
  ...element,
  id: newItemId(),
  ...(element.slots
    ? {
        slots: Object.fromEntries(
          Object.entries(element.slots).map(([name, slot]) => [
            name,
            slot && { ...slot, elements: slot.elements.map(freshIds) },
          ])
        ),
      }
    : {}),
});

/**
 * A new step after `index`, starting as a copy of it: the next screen is
 * usually this one with one thing changed.
 */
export const addStepAfter = (
  concept: ReviewConcept,
  index: number
): ReviewConcept => {
  const steps = stepsOf(concept);
  if (steps.length >= MAX_CONCEPT_STEPS) {
    return concept;
  }
  const from = steps[index] ?? steps.at(-1);
  const copy: ConceptStep = {
    caption: "",
    elements: (from?.elements ?? []).map(freshIds),
    id: newItemId(),
  };
  const later = [...(concept.steps ?? [])];
  later.splice(index, 0, copy);
  return { ...concept, steps: later };
};

/** The concept without step `index`; the first step can't be removed. */
export const removeStep = (
  concept: ReviewConcept,
  index: number
): ReviewConcept => {
  if (index === 0) {
    return concept;
  }
  const steps = (concept.steps ?? []).filter((_, i) => i !== index - 1);
  const { steps: _s, ...rest } = concept;
  return steps.length > 0 ? { ...rest, steps } : rest;
};

/** A trigger only while it names an element the step still has. */
const triggerIn = (
  trigger: unknown,
  elements: ReviewConceptElement[]
): { trigger?: string } =>
  typeof trigger === "string" && elements.some((e) => e.id === trigger)
    ? { trigger }
    : {};

/** Steps from the request or the database, cleaned like elements are. */
export const cleanSteps = (
  value: unknown,
  cleanElements: (value: unknown) => ReviewConceptElement[],
  str: (value: unknown, max: number) => string
): ConceptStep[] =>
  (Array.isArray(value) ? value : [])
    .slice(0, MAX_CONCEPT_STEPS - 1)
    .map((raw): ConceptStep => {
      const step = (raw ?? {}) as Partial<ConceptStep>;
      const elements = cleanElements(step.elements);
      return {
        caption: str(step.caption, MAX_STEP_CAPTION),
        elements,
        id: str(step.id, 64) || newItemId(),
        ...triggerIn(step.trigger, elements),
      };
    });

/** The first step's caption and trigger, cleaned. */
export const cleanFirstStep = (
  raw: Partial<ReviewConcept>,
  elements: ReviewConceptElement[],
  str: (value: unknown, max: number) => string
): Pick<ReviewConcept, "stepCaption" | "stepTrigger"> => {
  const caption = str(raw.stepCaption, MAX_STEP_CAPTION);
  const { trigger } = triggerIn(raw.stepTrigger, elements);
  return {
    ...(caption ? { stepCaption: caption } : {}),
    ...(trigger ? { stepTrigger: trigger } : {}),
  };
};

/**
 * A copy of a concept with new ids throughout, its triggers following the
 * elements they named, so it can sit beside the original or in another note.
 */
export const freshConcept = (concept: ReviewConcept): ReviewConcept => {
  const renamed = new Map<string, string>();
  const copyAll = (list: ReviewConceptElement[]) =>
    list.map((element) => {
      const copy = freshIds(element);
      renamed.set(element.id, copy.id);
      return copy;
    });
  const elements = copyAll(concept.elements);
  const steps = concept.steps?.map((step) => {
    const stepElements = copyAll(step.elements);
    const trigger = step.trigger ? renamed.get(step.trigger) : undefined;
    return {
      caption: step.caption,
      elements: stepElements,
      id: newItemId(),
      ...(trigger ? { trigger } : {}),
    };
  });
  const stepTrigger = concept.stepTrigger
    ? renamed.get(concept.stepTrigger)
    : undefined;
  const { stepTrigger: _t, steps: _s, ...rest } = concept;
  return {
    ...rest,
    elements,
    id: newItemId(),
    ...(stepTrigger ? { stepTrigger } : {}),
    ...(steps && steps.length > 0 ? { steps } : {}),
  };
};

/**
 * Another concept's screens as steps after `index`: a copied
 * recommendation shown again inside a sequence. The pasted concept's own
 * caption goes on its first step, or its title when it has none.
 */
export const pasteStepsAfter = (
  concept: ReviewConcept,
  index: number,
  pasted: ReviewConcept
): ReviewConcept => {
  const room = MAX_CONCEPT_STEPS - stepsOf(concept).length;
  const incoming = stepsOf(freshConcept(pasted))
    .slice(0, Math.max(0, room))
    .map((step, i) => ({
      ...step,
      caption: i === 0 ? step.caption || pasted.title : step.caption,
      id: newItemId(),
    }));
  if (incoming.length === 0) {
    return concept;
  }
  const later = [...(concept.steps ?? [])];
  later.splice(index, 0, ...incoming);
  return { ...concept, steps: later };
};
