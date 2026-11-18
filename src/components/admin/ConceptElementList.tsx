import { GripVertical } from "lucide-react";
import { type DragEvent, useId, useState } from "react";
import type { BrandKitDoc } from "../../../config/brandKit.js";
import { createConceptElement } from "../../../config/conceptDefaults.js";
import {
  MAX_GROUP_DEPTH,
  MAX_SLOT_DEPTH,
  MAX_SLOT_ELEMENTS,
} from "../../../config/conceptSlots.js";
import {
  type ConceptStyle,
  fromStyle,
  linkStyle,
  withOverrides,
} from "../../../config/conceptStyle.js";
import {
  MAX_CONCEPT_ELEMENTS,
  type ReviewConceptElement,
  type ReviewConceptElementKind,
} from "../../../config/reviewConcept.js";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { ConceptSelect, ELEMENT_KINDS, kindLabel } from "./ConceptControls";
import { useReviewCanvasComponents } from "./ReviewCanvasComponents";
import {
  addConceptElement,
  duplicateConceptElement,
} from "./ReviewConceptBrand";
import { ReviewConceptElementFields } from "./ReviewConceptElementFields";

/** What a dragged element carries: its list, then its place in it. */
const DRAG_TYPE = "text/x-concept-element";

/**
 * A list of elements to edit — a concept's, or what a card or panel holds —
 * with the menu that adds to it. The elements arrive styled (as the kit
 * draws them), so what is saved keeps each one's own values current.
 */
/** This element in a new group, in its place: the group to add more to. */
const wrapInGroup = (
  elements: ReviewConceptElement[],
  index: number,
  brandDoc?: BrandKitDoc | null
): ReviewConceptElement[] => {
  const element = elements[index];
  if (!element) {
    return elements;
  }
  const group = createConceptElement("group", brandDoc);
  return elements.map((e, i) =>
    i === index
      ? {
          ...group,
          group: {
            ...(group.group ?? { elements: [] }),
            elements: [element],
          },
        }
      : e
  );
};

/** A group's elements back in the list where the group was. */
const ungroup = (
  elements: ReviewConceptElement[],
  index: number
): ReviewConceptElement[] =>
  elements.flatMap((e, i) =>
    i === index && e.kind === "group" ? (e.group?.elements ?? []) : [e]
  );

/** The closest group earlier in this same list. */
const groupAbove = (
  elements: ReviewConceptElement[],
  index: number
): number => {
  for (let i = index - 1; i >= 0; i -= 1) {
    if (elements[i]?.kind === "group") {
      return i;
    }
  }
  return -1;
};

/** Moving a holder deeper must not make its contents disappear on save. */
const fitsAtDepth = (element: ReviewConceptElement, depth: number): boolean => {
  if (element.group && depth >= MAX_GROUP_DEPTH) {
    return false;
  }
  if (element.slots && depth >= MAX_SLOT_DEPTH) {
    return false;
  }
  const children = [
    ...(element.group?.elements ?? []),
    ...Object.values(element.slots ?? {}).flatMap(
      (slot) => slot?.elements ?? []
    ),
  ];
  return children.every((child) => fitsAtDepth(child, depth + 1));
};

/** This element moved to the end of the nearest group above it. */
const moveIntoGroupAbove = (
  elements: ReviewConceptElement[],
  index: number
): ReviewConceptElement[] => {
  const groupIndex = groupAbove(elements, index);
  const above = elements[groupIndex];
  const element = elements[index];
  if (
    !(above?.kind === "group" && element) ||
    (above.group?.elements.length ?? 0) >= MAX_SLOT_ELEMENTS
  ) {
    return elements;
  }
  return elements.flatMap((e, i) => {
    if (i === index) {
      return [];
    }
    if (i === groupIndex) {
      return [
        {
          ...e,
          group: {
            ...(e.group ?? { elements: [] }),
            elements: [...(e.group?.elements ?? []), element],
          },
        },
      ];
    }
    return [e];
  });
};

/** Group, Ungroup, and Into the group above, as each applies. */
function GroupActions({
  above,
  element,
  onGroup,
  onIntoAbove,
  onUngroup,
  depth,
}: {
  above?: ReviewConceptElement;
  element: ReviewConceptElement;
  onGroup: () => void;
  onIntoAbove: () => void;
  onUngroup: () => void;
  depth: number;
}) {
  const full = (above?.group?.elements.length ?? 0) >= MAX_SLOT_ELEMENTS;
  const tooDeep = depth >= MAX_GROUP_DEPTH || !fitsAtDepth(element, depth + 1);
  let moveTitle = "Move into the nearest group above";
  if (full) {
    moveTitle = "This group is full";
  } else if (tooDeep) {
    moveTitle = "This component is too deeply nested to move into this group";
  }
  return (
    <>
      {above?.kind === "group" ? (
        <Button
          disabled={full || tooDeep}
          onClick={onIntoAbove}
          size="xs"
          title={moveTitle}
          type="button"
          variant="ghost"
        >
          Into group above
        </Button>
      ) : null}
      {element.kind === "group" ? (
        <Button
          onClick={onUngroup}
          size="xs"
          title="Put its elements back in this list"
          type="button"
          variant="ghost"
        >
          Ungroup
        </Button>
      ) : (
        <Button
          onClick={onGroup}
          size="xs"
          title="Put this in a group, to lay it out with others"
          type="button"
          variant="ghost"
        >
          Group
        </Button>
      )}
    </>
  );
}

export function ConceptElementList({
  brandDoc,
  depth = 0,
  elements,
  label,
  onChange,
}: {
  brandDoc?: BrandKitDoc | null;
  /** How many slots deep this list sits: 0 for a concept's own elements. */
  depth?: number;
  elements: ReviewConceptElement[];
  label: string;
  onChange: (elements: ReviewConceptElement[]) => void;
}) {
  const styles = brandDoc?.componentStyles ?? [];
  const { data: canvasComponents = [], error: canvasError } =
    useReviewCanvasComponents();
  const limit = depth === 0 ? MAX_CONCEPT_ELEMENTS : MAX_SLOT_ELEMENTS;
  const full = elements.length >= limit;
  // Which list a drag started in: a slot's list sits inside its card's, and
  // a drop moves an element only within the list it came from.
  const listId = useId();
  const [over, setOver] = useState<number | null>(null);

  /** Order is the order drawn: move one element to another place. */
  const move = (from: number, to: number) => {
    if (to < 0 || to >= elements.length || from === to) {
      return;
    }
    const next = [...elements];
    const [element] = next.splice(from, 1);
    if (element) {
      next.splice(to, 0, element);
      onChange(next);
    }
  };
  const dragged = (event: DragEvent): number | null => {
    const [list, index] = event.dataTransfer.getData(DRAG_TYPE).split("|");
    return list === listId ? Number(index) : null;
  };

  const update = (id: string, patch: Partial<ReviewConceptElement>) =>
    onChange(
      elements.map((element) =>
        element.id === id
          ? { ...element, ...withOverrides(element, patch) }
          : element
      )
    );

  const link = (id: string, style: ConceptStyle | null) =>
    onChange(
      elements.map((element) =>
        element.id === id ? linkStyle(element, style) : element
      )
    );

  /** A kind ("button"), or a kit style ("style:<id>") to add already linked. */
  const add = (choice: string) => {
    if (full) {
      return;
    }
    const component = canvasComponents.find(
      (item) => `canvas:${item.id}` === choice
    );
    if (component) {
      onChange([
        ...elements,
        {
          ...createConceptElement("canvas", brandDoc),
          canvasComponent: component,
          text: component.name,
        },
      ]);
      return;
    }
    const style = styles.find((s) => `style:${s.id}` === choice);
    onChange(
      style
        ? [
            ...elements,
            fromStyle(createConceptElement(style.kind, brandDoc), style),
          ]
        : addConceptElement(
            elements,
            choice as ReviewConceptElementKind,
            brandDoc
          )
    );
  };
  const groups = [
    {
      label: "Components",
      options: ELEMENT_KINDS.map((option) => ({ ...option, disabled: full })),
    },
    ...(styles.length > 0
      ? [
          {
            label: "From the brand kit",
            options: styles.map((style) => ({
              disabled: full,
              label: `${kindLabel(style.kind)} · ${style.name}`,
              value: `style:${style.id}`,
            })),
          },
        ]
      : []),
    ...(canvasComponents.length > 0
      ? [
          {
            label: "Canvas components",
            options: canvasComponents.map((component) => ({
              disabled: full,
              label: component.name,
              value: `canvas:${component.id}`,
            })),
          },
        ]
      : []),
  ];

  return (
    <div className="review-concepts__elements">
      <div className="review-concepts__element-head">
        <Label>{label}</Label>
        <div className="review-concepts__add-actions">
          <ConceptSelect
            groups={groups}
            label={
              depth === 0 ? "Add a component" : `Add to ${label.toLowerCase()}`
            }
            onChange={add}
            placeholder="+ Add component"
            value=""
          />
        </div>
      </div>
      {canvasError ? (
        <p role="status">Couldn't load canvas components.</p>
      ) : null}
      {elements.map((element, index) => (
        // biome-ignore lint/a11y/noStaticElementInteractions: the row is a drop target; the handle inside it is the keyboard route
        // biome-ignore lint/a11y/noNoninteractiveElementInteractions: same
        <div
          className="review-concepts__sortable"
          data-drop-over={over === index || undefined}
          key={element.id}
          onDragLeave={() => setOver(null)}
          onDragOver={(event) => {
            if (event.dataTransfer.types.includes(DRAG_TYPE)) {
              event.preventDefault();
              setOver(index);
            }
          }}
          onDrop={(event) => {
            setOver(null);
            const from = dragged(event);
            if (from !== null) {
              // Handled here: the card's own list, around this one, keeps out.
              event.preventDefault();
              event.stopPropagation();
              move(from, index);
            }
          }}
        >
          <ReviewConceptElementFields
            actions={
              <GroupActions
                above={elements[groupAbove(elements, index)]}
                depth={depth}
                element={element}
                onGroup={() => onChange(wrapInGroup(elements, index, brandDoc))}
                onIntoAbove={() =>
                  onChange(moveIntoGroupAbove(elements, index))
                }
                onUngroup={() => onChange(ungroup(elements, index))}
              />
            }
            brandDoc={brandDoc}
            depth={depth}
            element={element}
            handle={
              <button
                aria-label={`Move ${kindLabel(element.kind)}: drag, or use the arrow keys`}
                className="review-concepts__handle"
                draggable
                onDragStart={(event) => {
                  event.stopPropagation();
                  event.dataTransfer.setData(DRAG_TYPE, `${listId}|${index}`);
                  event.dataTransfer.effectAllowed = "move";
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                    event.preventDefault();
                    move(index, index + (event.key === "ArrowUp" ? -1 : 1));
                  }
                }}
                title="Drag to reorder"
                type="button"
              >
                <GripVertical aria-hidden size={14} />
              </button>
            }
            onChange={(patch) => update(element.id, patch)}
            onDuplicate={() =>
              onChange(duplicateConceptElement(elements, element.id))
            }
            onLink={(style) => link(element.id, style)}
            onRemove={() =>
              onChange(elements.filter((item) => item.id !== element.id))
            }
            styles={styles.filter((style) => style.kind === element.kind)}
          />
        </div>
      ))}
    </div>
  );
}
