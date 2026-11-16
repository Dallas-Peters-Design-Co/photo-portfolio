import { GripVertical } from "lucide-react";
import { type DragEvent, useId, useState } from "react";
import type { BrandKitDoc } from "../../../config/brandKit.js";
import {
  type ConceptStyle,
  linkStyle,
  withOverrides,
} from "../../../config/conceptStyle.js";
import type {
  ReviewConceptElement,
  ReviewConceptElementKind,
} from "../../../config/reviewConcept.js";
import { Label } from "../ui/label";
import { ConceptSelect, ELEMENT_KINDS, kindLabel } from "./ConceptControls";
import {
  addConceptElement,
  createConceptElement,
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
    const style = styles.find((s) => `style:${s.id}` === choice);
    onChange(
      style
        ? [
            ...elements,
            linkStyle(createConceptElement(style.kind, brandDoc), style),
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
      options: ELEMENT_KINDS,
    },
    ...(styles.length > 0
      ? [
          {
            label: "From the brand kit",
            options: styles.map((style) => ({
              label: `${kindLabel(style.kind)} · ${style.name}`,
              value: `style:${style.id}`,
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
