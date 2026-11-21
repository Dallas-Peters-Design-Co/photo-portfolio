import { useMemo, useState } from "react";
import { createStatefulComponent } from "../../../config/componentStates.js";
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
import type { KitShader } from "../../../config/kitShaders.js";
import {
  boxOf,
  cleanPageDesign,
  type PageBox,
  type PageDesign,
  pageDesignOf,
} from "../../../config/pageDesign.js";
import {
  type DropPosition,
  movePageLayer,
  ungroupPageLayer,
} from "../../../config/pageLayerMove.js";
import {
  MAX_CONCEPT_ELEMENTS,
  type ReviewConceptElement,
  type ReviewConceptElementKind,
} from "../../../config/reviewConcept.js";
import { useKitCanvasComponents } from "../../components/admin/ReviewCanvasComponents";
import type { BoardItem } from "../../types";
import { useActiveBrand } from "../brand/ActiveBrand";
import { ungroupPlacement } from "./groupChildBoxes";

import type { LibraryPlacement } from "./pageLibraryDrag";

const createPageElement = (
  value: string,
  kind: ReviewConceptElementKind,
  doc: Parameters<typeof createConceptElement>[1]
) =>
  value === "stateful-component"
    ? createStatefulComponent(doc)
    : createConceptElement(kind, doc);

function insertionBox(
  page: PageDesign,
  element: ReviewConceptElement,
  count: number,
  placement?: LibraryPlacement
): PageBox {
  const component = element.canvasComponent;
  let width = Math.min(360, page.width - 48);
  let height = element.kind === "navbar" ? 80 : 240;
  if (element.kind === "navbar" || element.kind === "table") {
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
    y: Math.min(24 + count * 48, Math.max(0, page.height - height - 24)),
  };
  if (placement) {
    nextBox.x = Math.max(0, Math.min(placement.x, page.width - nextBox.width));
    nextBox.y = Math.max(
      0,
      Math.min(placement.y, page.height - nextBox.height)
    );
  }
  return nextBox;
}

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
  // The active kit may finish loading after the frame editor has opened.
  // Only unsaved frames follow it; a saved frame owns its kit choice.
  const page = pageDesignOf(frame.config) ?? {
    ...initial,
    kitId: brand?.kit?.id ?? null,
  };
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
  const elementsForGrouping = () =>
    elements.map((el) =>
      el.id === selected &&
      box &&
      (el.kind === "canvas" || el.kind === "shader")
        ? { ...el, canvasSize: { height: box.height, width: box.width } }
        : el
    );
  const groupSelected = () => {
    if (!(step && box && canGroup)) {
      return;
    }
    const next = wrapInGroup(elementsForGrouping(), rootIndex, doc);
    const group = next[rootIndex];
    if (!group) {
      return;
    }
    const cell = page.grid?.cells[elements[rootIndex].id];
    write({
      ...resolved,
      ...(cell && page.grid
        ? {
            grid: {
              ...page.grid,
              cells: { ...page.grid.cells, [group.id]: cell },
            },
          }
        : {}),
      boxes: { ...page.boxes, [group.id]: box },
      concept: withStep(concept, at, { ...step, elements: next }),
    });
    setSelected(group.id);
  };
  const setBox = (id: string, next: PageBox) =>
    write({ ...resolved, boxes: { ...page.boxes, [id]: next } });
  const add = (
    value: string,
    shader?: KitShader,
    placement?: LibraryPlacement
  ) => {
    if (elements.length >= MAX_CONCEPT_ELEMENTS) {
      return;
    }
    const style = doc?.componentStyles.find((s) => s.id === value);
    const component = canvasComponents.find(
      (item) => `canvas:${item.id}` === value
    );
    const kind = style?.kind ?? (value as ReviewConceptElementKind);
    let next = createPageElement(value, component ? "canvas" : kind, doc);
    if (component) {
      next = { ...next, canvasComponent: component, text: component.name };
    }
    if (shader) {
      next = { ...next, shader, text: shader.name };
    }
    if (style) {
      next = fromStyle(next, style);
    }
    const nextBox = insertionBox(page, next, elements.length, placement);
    if (step) {
      write({
        ...resolved,
        ...(page.grid && placement?.cell
          ? {
              grid: {
                ...page.grid,
                cells: { ...page.grid.cells, [next.id]: placement.cell },
              },
            }
          : {}),
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
    const cells = { ...page.grid?.cells };
    for (const [i, el] of copied.entries()) {
      const source = page.grid?.cells[elements[i]?.id ?? ""];
      if (source) {
        cells[el.id] = source;
      }
      boxes[el.id] = boxOf(page, elements[i]?.id ?? "", i);
    }
    write({
      ...resolved,
      boxes,
      concept: next,
      grid: page.grid && { ...page.grid, cells },
    });
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
  const reorderLayers = (next: ReviewConceptElement[]) => {
    if (!step) {
      return;
    }
    // Older designs can position a layer by its index. Preserve that box
    // before changing paint order so the layer stays at the same coordinates.
    const boxes = { ...page.boxes };
    for (const [i, el] of elements.entries()) {
      if (next[i]?.id !== el.id) {
        boxes[el.id] ??= boxOf(page, el.id, i);
      }
    }
    write({
      ...resolved,
      boxes,
      concept: withStep(concept, at, { ...step, elements: next }),
    });
    setPlaying(false);
  };
  const ungroupLayer = (id: string) => {
    const group = all.find((item) => item.id === id && item.kind === "group");
    if (!(group && step)) {
      return;
    }
    const next = ungroupPageLayer(elements, id);
    if (next === elements) {
      return;
    }
    const groupIndex = elements.findIndex((item) => item.id === id);
    const groupBox = groupIndex >= 0 ? boxOf(page, id, groupIndex) : undefined;
    write({
      ...resolved,
      ...(groupBox ? ungroupPlacement(page, elements, group, groupBox) : {}),
      concept: withStep(concept, at, { ...step, elements: next }),
    });
    setSelected(group.group?.elements[0]?.id ?? null);
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
            setElements(moveIntoGroupAbove(elementsForGrouping(), rootIndex));
            setSelected(above.id);
          }
        : undefined,
    moveLayer: (id: string, target: string, position: DropPosition) => {
      const i = elements.findIndex((el) => el.id === id);
      const next = movePageLayer(
        elements,
        id,
        target,
        position,
        i < 0 ? undefined : boxOf(page, id, i)
      );
      if (next !== elements) {
        reorderLayers(next);
        setSelected(id);
      }
    },
    page,
    patchElement,
    playing,
    removeSelected,
    removeState,
    reorderLayers,
    resolved,
    selected,
    setBox,
    setIndex,
    setPlaying,
    setSelected,
    step,
    steps,
    ungroupLayer,
    ungroupSelected: () => {
      if (element?.kind === "group") {
        ungroupLayer(element.id);
      }
    },
    write,
  };
};
