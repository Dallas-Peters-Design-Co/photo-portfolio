import { ChevronDown, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import type { BrandKitDoc } from "../../../config/brandKit.js";
import {
  type ConceptStyle,
  lookOf,
  MAX_CONCEPT_STYLES,
} from "../../../config/conceptStyle.js";
import { newItemId } from "../../../config/proposal.js";
import type { ReviewConceptElementKind } from "../../../config/reviewConcept.js";
import { rememberedOpen, rememberOpen } from "../../hooks/useRememberedOpen";
import { ReviewConceptElementView } from "../review/ReviewConceptElementView";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ConceptSelect, ELEMENT_KINDS, kindLabel } from "./ConceptControls";
import { createConceptElement, styleSample } from "./ReviewConceptBrand";
import { ReviewConceptElementFields } from "./ReviewConceptElementFields";
import "./ReviewConceptsEditor.css";

/** One style: a row (fold, type, name, remove) that opens to its sample and look. */
function StyleEditor({
  brand,
  onChange,
  onRemove,
  onToggle,
  open,
  style,
}: {
  brand: BrandKitDoc;
  onChange: (next: ConceptStyle) => void;
  onRemove: () => void;
  onToggle: () => void;
  open: boolean;
  style: ConceptStyle;
}) {
  const bodyId = useId();
  const sample = styleSample(style, brand);
  return (
    <section className="brand-kit-components__style">
      <header className="brand-kit-components__head">
        <button
          aria-controls={bodyId}
          aria-expanded={open}
          aria-label={`${open ? "Fold" : "Open"} ${kindLabel(style.kind)} ${style.name}`}
          // The same fold control as an element's, so the two read alike.
          className="review-concepts__element-toggle"
          onClick={onToggle}
          type="button"
        >
          <ChevronDown aria-hidden size={14} />
          <span>{kindLabel(style.kind)}</span>
        </button>
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
      {open ? (
        <div className="brand-kit-components__body" id={bodyId}>
          <div className="brand-kit-components__sample concept-canvas">
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
        </div>
      ) : null}
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
  // Folded by default: the list reads as a list of styles until one is
  // opened. Which are open is remembered in this browser across reloads.
  const [open, setOpen] = useState<ReadonlySet<string>>(
    () =>
      new Set(
        [...styles, ...inherited]
          .map((style) => style.id)
          .filter((id) => rememberedOpen(`kit-style:${id}`))
      )
  );
  const toggle = (id: string) =>
    setOpen((was) => {
      const next = new Set(was);
      if (!next.delete(id)) {
        next.add(id);
      }
      rememberOpen(`kit-style:${id}`, next.has(id));
      return next;
    });

  const add = (choice: string) => {
    // Adding to a sub-brand that uses its parent's styles starts from those,
    // or every review linked to them would stop following.
    const base = styles.length === 0 ? inherited : styles;
    if (base.length >= MAX_CONCEPT_STYLES) {
      return;
    }
    const kind = choice as ReviewConceptElementKind;
    const count = base.filter((style) => style.kind === kind).length;
    const id = newItemId();
    // A new style opens, ready to style; the rest stay as they were.
    setOpen((was) => new Set(was).add(id));
    set([
      ...base,
      {
        id,
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
          onToggle={() => toggle(style.id)}
          open={open.has(style.id)}
          style={style}
        />
      ))}
    </div>
  );
}
