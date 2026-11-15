import { Trash2 } from "lucide-react";
import type { BrandKitDoc } from "../../../config/brandKit.js";
import {
  type ConceptStyle,
  linkStyle,
  lookOf,
  MAX_CONCEPT_STYLES,
} from "../../../config/conceptStyle.js";
import { newItemId } from "../../../config/proposal.js";
import {
  type ReviewConceptElement,
  type ReviewConceptElementKind,
  takesIcon,
} from "../../../config/reviewConcept.js";
import { ReviewConceptElementView } from "../review/ReviewConceptElementView";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ConceptSelect, ELEMENT_KINDS, kindLabel } from "./ConceptControls";
import { createConceptElement } from "./ReviewConceptBrand";
import { ReviewConceptElementFields } from "./ReviewConceptElementFields";
import "./ReviewConceptsEditor.css";

/**
 * What a style is drawn on: its kind's sample content, in the style's look.
 * A stand-in icon on kinds that take one, so the icon size and colour show.
 */
const sampleOf = (
  style: ConceptStyle,
  brand: BrandKitDoc
): ReviewConceptElement =>
  linkStyle(
    {
      ...createConceptElement(style.kind, brand),
      id: style.id,
      ...(takesIcon(style.kind) ? { iconName: "StarIcon" } : {}),
    },
    style
  );

function StyleEditor({
  brand,
  onChange,
  onRemove,
  style,
}: {
  brand: BrandKitDoc;
  onChange: (next: ConceptStyle) => void;
  onRemove: () => void;
  style: ConceptStyle;
}) {
  const sample = sampleOf(style, brand);
  return (
    <section className="brand-kit-components__style">
      <header className="brand-kit-components__head">
        <span>{kindLabel(style.kind)}</span>
        <Input
          aria-label={`${kindLabel(style.kind)} style name`}
          onChange={(event) => onChange({ ...style, name: event.target.value })}
          placeholder="Primary"
          size="sm"
          value={style.name}
        />
        <Button
          aria-label={`Remove ${style.name}`}
          onClick={onRemove}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <Trash2 size={13} />
        </Button>
      </header>
      <div className="brand-kit-components__sample">
        <ReviewConceptElementView element={sample} />
      </div>
      <ReviewConceptElementFields
        brandDoc={brand}
        element={sample}
        lookOnly
        onChange={(patch) =>
          onChange({ ...style, look: lookOf({ ...sample, ...patch }) })
        }
      />
    </section>
  );
}

/**
 * The kit's component styles: each styled once here, then picked by review
 * concepts, which follow it from then on (config/conceptStyle.ts).
 *
 * A sub-brand with none of its own uses its parent's; "Make them this
 * brand's" copies them in to change.
 */
export function BrandKitComponents({
  doc,
  effective,
  onChange,
}: {
  doc: BrandKitDoc;
  /** The kit as it resolves, parent included: its palette and type. */
  effective: BrandKitDoc;
  onChange: (next: BrandKitDoc) => void;
}) {
  const styles = doc.componentStyles;
  const inherited: ConceptStyle[] =
    styles.length === 0 ? effective.componentStyles : [];
  const set = (next: ConceptStyle[]) =>
    onChange({ ...doc, componentStyles: next });

  const add = (choice: string) => {
    // Adding to a sub-brand that uses its parent's styles starts from those,
    // or every review linked to them would stop following.
    const base = styles.length === 0 ? inherited : styles;
    if (base.length >= MAX_CONCEPT_STYLES) {
      return;
    }
    const kind = choice as ReviewConceptElementKind;
    const count = base.filter((style) => style.kind === kind).length;
    set([
      ...base,
      {
        id: newItemId(),
        kind,
        look: lookOf(createConceptElement(kind, effective)),
        name: count === 0 ? "Primary" : `Style ${count + 1}`,
      },
    ]);
  };

  return (
    <div className="stack stack--snug">
      <p className="brand-kit__hint">
        Style a button, badge, card or table once. Review concepts that pick a
        style follow it, so a change here shows on every review.
      </p>
      {inherited.length > 0 ? (
        <p className="brand-kit__hint">
          Using the parent brand's {inherited.length}{" "}
          {inherited.length === 1 ? "style" : "styles"}.{" "}
          <Button
            onClick={() => set(inherited)}
            size="xs"
            type="button"
            variant="outline"
          >
            Make them this brand's
          </Button>
        </p>
      ) : null}
      <div className="brand-kit-components__add">
        <ConceptSelect
          label="Add a component style"
          onChange={add}
          options={ELEMENT_KINDS}
          placeholder={
            styles.length >= MAX_CONCEPT_STYLES
              ? "Style limit reached"
              : "+ Add a style"
          }
          value=""
        />
      </div>
      {styles.map((style) => (
        <StyleEditor
          brand={effective}
          key={style.id}
          onChange={(next) =>
            set(styles.map((s) => (s.id === style.id ? next : s)))
          }
          onRemove={() => set(styles.filter((s) => s.id !== style.id))}
          style={style}
        />
      ))}
    </div>
  );
}
