import { ChevronDown, Copy, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import type { BrandKitDoc } from "../../../config/brandKit.js";
import {
  type ReviewConceptElement,
  takesIcon,
} from "../../../config/reviewConcept.js";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import {
  ConceptField,
  ConceptGroup,
  ConceptSelect,
  NumberField,
  optionsOf,
} from "./ConceptControls";
import { ConceptFontField } from "./ConceptFontField";
import { ConceptColorField } from "./ReviewConceptBrand";
import { CardShadowGroup, ElementIconGroup } from "./ReviewConceptCardFields";
import { ReviewConceptContentField } from "./ReviewConceptContentField";

type Patch = Partial<ReviewConceptElement>;

const OPTION_KINDS = new Set(["select", "tabs", "table", "menu"]);
const INPUT_TYPES = optionsOf([
  ["text", "Text"],
  ["email", "Email"],
  ["search", "Search"],
  ["url", "URL"],
  ["tel", "Phone"],
  ["password", "Password"],
]);
const SIZE_LABELS: Partial<Record<ReviewConceptElement["kind"], string>> = {
  card: "Title size",
  icon: "Icon size",
};
const WEIGHTS = optionsOf([
  ["400", "Regular"],
  ["500", "Medium"],
  ["600", "Semibold"],
  ["700", "Bold"],
]);

const SUMMARY_LENGTH = 48;

/** What a folded element says about itself: its first line of text. */
const summaryOf = (element: ReviewConceptElement): string => {
  const text = (element.text || element.placeholder || "").split("\n")[0] ?? "";
  return text.length > SUMMARY_LENGTH
    ? `${text.slice(0, SUMMARY_LENGTH)}…`
    : text;
};

function ContentGroup({
  element,
  onChange,
}: {
  element: ReviewConceptElement;
  onChange: (patch: Patch) => void;
}) {
  const checkedId = useId();
  return (
    <ConceptGroup name="Content">
      <ReviewConceptContentField element={element} onChange={onChange} />
      {element.kind === "input" || element.kind === "textarea" ? (
        <ConceptField label="Placeholder" wide>
          <Input
            aria-label="Placeholder"
            onChange={(event) => onChange({ placeholder: event.target.value })}
            size="sm"
            value={element.placeholder ?? ""}
          />
        </ConceptField>
      ) : null}
      {OPTION_KINDS.has(element.kind) ? (
        <ConceptField label="Options, comma separated" wide>
          <Input
            aria-label="Options, comma separated"
            onChange={(event) =>
              onChange({
                options: event.target.value
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean)
                  .slice(0, 8),
              })
            }
            size="sm"
            value={(element.options ?? []).join(", ")}
          />
        </ConceptField>
      ) : null}
      {element.kind === "input" ? (
        <ConceptField label="Input type">
          <ConceptSelect
            label="Input type"
            onChange={(inputType) =>
              onChange({
                inputType: inputType as ReviewConceptElement["inputType"],
              })
            }
            options={INPUT_TYPES}
            value={element.inputType ?? "text"}
          />
        </ConceptField>
      ) : null}
      {element.kind === "checkbox" ? (
        <label className="review-concepts__check" htmlFor={checkedId}>
          <Checkbox
            checked={element.checked ?? false}
            id={checkedId}
            onChange={(event) => onChange({ checked: event.target.checked })}
          />
          <span>Checked</span>
        </label>
      ) : null}
    </ConceptGroup>
  );
}

export function ReviewConceptElementFields({
  brandDoc,
  element,
  onChange,
  onDuplicate,
  onRemove,
}: {
  brandDoc?: BrandKitDoc | null;
  element: ReviewConceptElement;
  onChange: (patch: Patch) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(true);
  const bodyId = useId();
  return (
    <section aria-label={element.kind} className="review-concepts__element">
      <header className="review-concepts__element-bar">
        <button
          aria-controls={bodyId}
          aria-expanded={open}
          className="review-concepts__element-toggle"
          onClick={() => setOpen(!open)}
          type="button"
        >
          <ChevronDown aria-hidden size={14} />
          <span>{element.kind}</span>
          {open ? null : <small>{summaryOf(element)}</small>}
        </button>
        <Button
          aria-label={`Duplicate ${element.kind}`}
          onClick={onDuplicate}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <Copy size={13} />
        </Button>
        <Button
          aria-label={`Remove ${element.kind}`}
          onClick={onRemove}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <Trash2 size={13} />
        </Button>
      </header>
      {open ? (
        <div className="review-concepts__element-body" id={bodyId}>
          <ContentGroup element={element} onChange={onChange} />
          {takesIcon(element.kind) ? (
            <ElementIconGroup
              brandDoc={brandDoc}
              element={element}
              onChange={onChange}
            />
          ) : null}
          <ConceptGroup name="Type">
            <ConceptFontField
              brandDoc={brandDoc}
              family={element.fontFamily}
              fontId={element.fontId}
              fontRef={element.fontRef}
              label="Typeface"
              onChange={onChange}
            />
            <NumberField
              label={SIZE_LABELS[element.kind] ?? "Size"}
              max={72}
              onChange={(fontSize) => onChange({ fontSize })}
              value={element.fontSize}
            />
            {element.kind === "card" ? (
              <NumberField
                label="Body size"
                max={72}
                onChange={(bodySize) => onChange({ bodySize })}
                value={element.bodySize ?? element.fontSize}
              />
            ) : null}
            <ConceptField label="Weight">
              <ConceptSelect
                label="Weight"
                onChange={(weight) =>
                  onChange({
                    fontWeight: Number(
                      weight
                    ) as ReviewConceptElement["fontWeight"],
                  })
                }
                options={WEIGHTS}
                value={String(element.fontWeight)}
              />
            </ConceptField>
            <NumberField
              label="Line height"
              max={2.4}
              onChange={(lineHeight) => onChange({ lineHeight })}
              step={0.05}
              value={element.lineHeight}
            />
          </ConceptGroup>
          <ConceptGroup name="Box">
            <NumberField
              label="Radius"
              max={48}
              onChange={(radius) => onChange({ radius })}
              value={element.radius}
            />
            <NumberField
              label="Padding X"
              max={48}
              onChange={(paddingX) => onChange({ paddingX })}
              value={element.paddingX}
            />
            <NumberField
              label="Padding Y"
              max={32}
              onChange={(paddingY) => onChange({ paddingY })}
              value={element.paddingY}
            />
          </ConceptGroup>
          {element.kind === "card" ? (
            <CardShadowGroup
              brandDoc={brandDoc}
              element={element}
              onChange={onChange}
            />
          ) : null}
          <ConceptGroup name="Color">
            <ConceptColorField
              ariaLabel={`${element.kind} text color`}
              brandDoc={brandDoc}
              label="Text"
              onChange={(color) => onChange({ color })}
              value={element.color}
            />
            {element.background === "transparent" ? null : (
              <ConceptColorField
                ariaLabel={`${element.kind} background`}
                brandDoc={brandDoc}
                label="Fill"
                onChange={(background) => onChange({ background })}
                value={element.background}
              />
            )}
            {element.kind === "card" ? (
              <ConceptColorField
                ariaLabel="card border color"
                brandDoc={brandDoc}
                label="Border"
                onChange={(borderColor) => onChange({ borderColor })}
                value={element.borderColor ?? "#d0d5dd"}
              />
            ) : null}
          </ConceptGroup>
        </div>
      ) : null}
    </section>
  );
}
