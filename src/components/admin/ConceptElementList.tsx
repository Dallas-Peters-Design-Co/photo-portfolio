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
      {elements.map((element) => (
        <ReviewConceptElementFields
          brandDoc={brandDoc}
          depth={depth}
          element={element}
          key={element.id}
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
      ))}
    </div>
  );
}
