import { CornerLeftUp, GripVertical, Group, Ungroup } from "lucide-react";
import type { ReactNode } from "react";
import { useSWRConfig } from "swr";
import type { BrandKitDoc } from "../../../config/brandKit.js";
import { createConceptElement } from "../../../config/conceptDefaults.js";
import {
  fitsAtDepth,
  groupAbove,
  moveIntoGroupAbove,
  ungroup,
  wrapInGroup,
} from "../../../config/conceptGroups.js";
import {
  MAX_GROUP_DEPTH,
  MAX_SLOT_ELEMENTS,
} from "../../../config/conceptSlots.js";
import {
  type ConceptStyle,
  fromStyle,
  linkStyle,
  withOverrides,
} from "../../../config/conceptStyle.js";
import {
  type DropPosition,
  movePageLayer,
} from "../../../config/pageLayerMove.js";
import {
  MAX_CONCEPT_ELEMENTS,
  type ReviewConceptElement,
  type ReviewConceptElementKind,
} from "../../../config/reviewConcept.js";
import {
  LayerDragProvider,
  useLayerDrag,
} from "../../boards/pages/PageLayerDrag";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { ConceptSelect, ELEMENT_KINDS, kindLabel } from "./ConceptControls";
import { useReviewCanvasComponents } from "./ReviewCanvasComponents";
import {
  addConceptElement,
  duplicateConceptElement,
} from "./ReviewConceptBrand";
import { ReviewConceptElementFields } from "./ReviewConceptElementFields";

/**
 * A list of elements to edit — a concept's, or what a card or panel holds —
 * with the menu that adds to it. The elements arrive styled (as the kit
 * draws them), so what is saved keeps each one's own values current.
 */
/** Group, Ungroup, and Into the group above, as each applies. */
function GroupActions({
  above,
  element,
  onGroup,
  onIntoAbove,
  onUngroup,
  canUngroup,
  depth,
}: {
  above?: ReviewConceptElement;
  element: ReviewConceptElement;
  onGroup: () => void;
  onIntoAbove: () => void;
  onUngroup: () => void;
  canUngroup: boolean;
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
          aria-label="Into group above"
          disabled={full || tooDeep}
          onClick={onIntoAbove}
          size="icon-sm"
          title={moveTitle}
          type="button"
          variant="ghost"
        >
          <CornerLeftUp aria-hidden size={14} />
        </Button>
      ) : null}
      {element.kind === "group" ? (
        <Button
          aria-label="Ungroup"
          disabled={!canUngroup}
          onClick={onUngroup}
          size="icon-sm"
          title="Put its elements back in this list"
          type="button"
          variant="ghost"
        >
          <Ungroup aria-hidden size={14} />
        </Button>
      ) : (
        <Button
          aria-label="Group"
          onClick={onGroup}
          size="icon-sm"
          title="Put this in a group, to lay it out with others"
          type="button"
          variant="ghost"
        >
          <Group aria-hidden size={14} />
        </Button>
      )}
    </>
  );
}

export function LayerListBoundary({
  elements,
  onChange,
  children,
}: {
  elements: ReviewConceptElement[];
  onChange: (items: ReviewConceptElement[]) => void;
  children: ReactNode;
}) {
  const drag = useLayerDrag();
  if (drag.enabled) {
    return children;
  }
  return (
    <LayerDragProvider
      move={(id, target, position) => {
        const next = movePageLayer(elements, id, target, position);
        if (next !== elements) {
          onChange(next);
        }
      }}
    >
      {children}
    </LayerDragProvider>
  );
}
export function ConceptElementList(props: Parameters<typeof ElementList>[0]) {
  return (
    <LayerListBoundary elements={props.elements} onChange={props.onChange}>
      <ElementList {...props} />
    </LayerListBoundary>
  );
}
function ElementList({
  brandDoc,
  depth = 0,
  elements,
  label,
  initiallyOpen = false,
  destination,
  gridColumns,
  onChange,
}: {
  brandDoc?: BrandKitDoc | null;
  /** How many slots deep this list sits: 0 for a concept's own elements. */
  depth?: number;
  elements: ReviewConceptElement[];
  label: string;
  initiallyOpen?: boolean;
  destination?: { id: string; position: DropPosition };
  gridColumns?: number;
  onChange: (elements: ReviewConceptElement[]) => void;
}) {
  const styles = brandDoc?.componentStyles ?? [];
  const {
    data: canvasComponents = [],
    error: canvasError,
    mutate: refreshCanvasComponents,
  } = useReviewCanvasComponents();
  const { mutate: refreshCache } = useSWRConfig();
  const limit = depth === 0 ? MAX_CONCEPT_ELEMENTS : MAX_SLOT_ELEMENTS;
  const full = elements.length >= limit;
  const drag = useLayerDrag();
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
  const savedGroups = styles.filter((style) => style.kind === "group");
  const otherStyles = styles.filter((style) => style.kind !== "group");
  const groups = [
    {
      label: "Components",
      options: ELEMENT_KINDS.map((option) => ({ ...option, disabled: full })),
    },
    ...(savedGroups.length > 0
      ? [
          {
            label: "Saved groups",
            options: savedGroups.map((style) => ({
              disabled: full,
              label: style.name,
              value: `style:${style.id}`,
            })),
          },
        ]
      : []),
    ...(otherStyles.length > 0
      ? [
          {
            label: "Other brand kit styles",
            options: otherStyles.map((style) => ({
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
      <div
        className="review-concepts__element-head"
        {...(destination && drag.target(destination.id, destination.position))}
      >
        <Label>{label}</Label>
        <div className="review-concepts__add-actions">
          <ConceptSelect
            groups={groups}
            label={
              depth === 0 ? "Add a component" : `Add to ${label.toLowerCase()}`
            }
            onChange={add}
            onOpenChange={(open) => {
              if (open) {
                void refreshCanvasComponents();
                void refreshCache(
                  (key) => Array.isArray(key) && key[0] === "brand-kits"
                );
              }
            }}
            placeholder="+ Add component"
            value=""
          />
        </div>
      </div>
      {canvasError ? (
        <p role="status">Couldn't load canvas components.</p>
      ) : null}
      {elements.map((element, index) => (
        <div
          className="review-concepts__sortable"
          key={element.id}
          {...drag.target(element.id)}
        >
          <ReviewConceptElementFields
            actions={
              <GroupActions
                above={elements[groupAbove(elements, index)]}
                canUngroup={
                  elements.length - 1 + (element.group?.elements.length ?? 0) <=
                  limit
                }
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
            gridColumns={gridColumns}
            handle={
              <button
                aria-label={`Move ${kindLabel(element.kind)}: drag, or use the arrow keys`}
                className="review-concepts__handle"
                draggable
                onDragEnd={drag.props(element.id, false).onDragEnd}
                onDragStart={drag.props(element.id, false).onDragStart}
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
            initiallyOpen={initiallyOpen}
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
