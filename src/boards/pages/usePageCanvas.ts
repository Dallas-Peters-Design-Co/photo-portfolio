import { useMemo, useState } from "react";

import {
  createConcept,
  createConceptElement,
} from "../../../config/conceptDefaults.js";
import {
  fitsAtDepth,
  groupAbove,
  moveIntoGroupAbove,
  wrapInGroup,
} from "../../../config/conceptGroups.js";
import {
  everyElement,
  MAX_SLOT_ELEMENTS,
  mapChildren,
} from "../../../config/conceptSlots.js";
import {
  addStepAfter,
  removeStep,
  stepsOf,
  withStep,
} from "../../../config/conceptSteps.js";
import {
  applyConceptStyles,
  fromStyle,
  withOverrides,
} from "../../../config/conceptStyle.js";
import {
  boxOf,
  cleanPageDesign,
  type PageBox,
  type PageDesign,
  pageDesignOf,
} from "../../../config/pageDesign.js";
import {
  MAX_CONCEPT_ELEMENTS,
  type ReviewConceptElement,
  type ReviewConceptElementKind,
} from "../../../config/reviewConcept.js";
import { useKitCanvasComponents } from "../../components/admin/ReviewCanvasComponents";
import type { BoardItem } from "../../types";
import { useActiveBrand } from "../brand/ActiveBrand";

export const usePageCanvas = (
  frame: BoardItem,
  onChange: (page: PageDesign) => void
) => {
  const brand = useActiveBrand();
  const [initial] = useState<PageDesign>(() => ({
    boxes: {},
    concept: {
      ...createConcept(brand?.kit?.resolvedDoc),
      elements: [],
      title: frame.body || "Page",
    },
    height: Math.max(200, Math.min(12_000, Math.round(frame.height * 2))),
    kitId: brand?.kit?.id ?? null,
    version: 1,
    width: Math.max(320, Math.min(4096, Math.round(frame.width * 2))),
  }));
  const page = pageDesignOf(frame.config) ?? initial;
  const { data: canvasComponents = [], error: canvasError } =
    useKitCanvasComponents(page.kitId);
  const kit = brand?.kits.find((k) => k.id === page.kitId) ?? null;
  const doc = kit?.resolvedDoc;
  const concept = useMemo(
    () =>
      applyConceptStyles([page.concept], doc?.componentStyles ?? [])[0] ??
      page.concept,
    [page.concept, doc]
  );
  const resolved = { ...page, concept };
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const steps = stepsOf(concept);
  const at = Math.min(index, steps.length - 1);
  const step = steps[at];
  const elements = step?.elements ?? [];
  const all = everyElement(elements);
  const element = all.find((e) => e.id === selected);
  const rootIndex = elements.findIndex((e) => e.id === selected);
  const box =
    element && rootIndex >= 0 ? boxOf(page, element.id, rootIndex) : null;
  const write = (next: PageDesign) => {
    const clean = cleanPageDesign(next);
    if (clean) {
      onChange(clean);
    }
  };
  const setElements = (next: ReviewConceptElement[]) => {
    if (step) {
      write({
        ...resolved,
        concept: withStep(concept, at, { ...step, elements: next }),
      });
    }
  };
  const patchElement = (
    patch: Partial<ReviewConceptElement>,
    followStyle = false,
    targetId = selected
  ) => {
    const change = (e: ReviewConceptElement): ReviewConceptElement => {
      const next =
        e.id === targetId
          ? { ...e, ...(followStyle ? patch : withOverrides(e, patch)) }
          : e;
      return mapChildren(next, change);
    };
    setElements(elements.map(change));
  };
  const removeSelected = () => {
    if (!selected) {
      return;
    }
    const keep = (item: ReviewConceptElement) => item.id !== selected;
    if (rootIndex >= 0) {
      setElements(elements.filter(keep));
      setSelected(null);
      return;
    }
    for (const parent of all) {
      const slot = Object.entries(parent.slots ?? {}).find(([, value]) =>
        value.elements.some((item) => item.id === selected)
      );
      if (slot) {
        const [name, value] = slot;
        patchElement(
          {
            slots: {
              ...parent.slots,
              [name]: { ...value, elements: value.elements.filter(keep) },
            },
          },
          false,
          parent.id
        );
        setSelected(parent.id);
        return;
      }
      if (parent.group?.elements.some((item) => item.id === selected)) {
        patchElement(
          {
            group: {
              ...parent.group,
              elements: parent.group.elements.filter(keep),
            },
          },
          false,
          parent.id
        );
        setSelected(parent.id);
        return;
      }
    }
  };
  const canGroup = Boolean(element && box && fitsAtDepth(element, 1));
  const above = elements[groupAbove(elements, rootIndex)];
  const groupSelected = () => {
    if (!(step && box && canGroup)) {
      return;
    }
    const next = wrapInGroup(elements, rootIndex, doc);
    const group = next[rootIndex];
    if (!group) {
      return;
    }
    write({
      ...resolved,
      boxes: { ...page.boxes, [group.id]: box },
      concept: withStep(concept, at, { ...step, elements: next }),
    });
    setSelected(group.id);
  };
  const setBox = (id: string, next: PageBox) =>
    write({ ...resolved, boxes: { ...page.boxes, [id]: next } });
  const add = (value: string) => {
    if (elements.length >= MAX_CONCEPT_ELEMENTS) {
      return;
    }
    const style = doc?.componentStyles.find((s) => s.id === value);
    const component = canvasComponents.find(
      (item) => `canvas:${item.id}` === value
    );
    const kind = component
      ? "canvas"
      : (style?.kind ?? (value as ReviewConceptElementKind));
    let next = createConceptElement(kind, doc);
    if (component) {
      next = { ...next, canvasComponent: component, text: component.name };
    }
    if (style) {
      next = fromStyle(next, style);
    }
    let width = Math.min(360, page.width - 48);
    let height = kind === "navbar" ? 80 : 240;
    if (kind === "navbar" || kind === "table") {
      width = page.width - 48;
    }
    if (component) {
      const scale = Math.min(
        1,
        (page.width - 48) / component.width,
        (page.height - 48) / component.height
      );
      width = component.width * scale;
      height = component.height * scale;
    }
    const nextBox = {
      height: Math.min(height, page.height - 48),
      width,
      x: 24,
      y: Math.min(
        24 + elements.length * 48,
        Math.max(0, page.height - height - 24)
      ),
    };
    if (step) {
      write({
        ...resolved,
        boxes: { ...page.boxes, [next.id]: nextBox },
        concept: withStep(concept, at, {
          ...step,
          elements: [...elements, next],
        }),
      });
    }
    setSelected(next.id);
  };
  const addStep = () => {
    const next = addStepAfter(concept, at);
    const copied = stepsOf(next)[at + 1]?.elements ?? [];
    const boxes = { ...page.boxes };
    for (const [i, el] of copied.entries()) {
      boxes[el.id] = boxOf(page, elements[i]?.id ?? "", i);
    }
    write({ ...resolved, boxes, concept: next });
    setIndex(at + 1);
    setSelected(null);
  };
  const removeState = () => {
    if (at === 0) {
      return;
    }
    write({ ...resolved, concept: removeStep(concept, at) });
    setIndex(at - 1);
    setSelected(null);
    setPlaying(false);
  };
  return {
    add,
    addStep,
    all,
    at,
    box,
    brand,
    canGroup,
    canvasComponents,
    canvasError,
    concept,
    doc,
    element,
    elements,
    groupSelected,
    index,
    moveIntoGroup:
      canGroup &&
      above &&
      (above.group?.elements.length ?? 0) < MAX_SLOT_ELEMENTS
        ? () => {
            setElements(moveIntoGroupAbove(elements, rootIndex));
            setSelected(above.id);
          }
        : undefined,
    page,
    patchElement,
    playing,
    removeSelected,
    removeState,
    resolved,
    selected,
    setBox,
    setIndex,
    setPlaying,
    setSelected,
    step,
    steps,
    write,
  };
};
