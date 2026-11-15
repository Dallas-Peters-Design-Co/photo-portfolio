import { Copy, Trash2 } from "lucide-react";
import { type ReactNode, useId } from "react";
import type { BrandKitDoc } from "../../../config/brandKit.js";
import type { ReviewConceptElement } from "../../../config/reviewConcept.js";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { ConceptFontField } from "./ConceptFontField";
import { ConceptField, ConceptSelect, optionsOf } from "./ConceptSelect";
import { ConceptColorField } from "./ReviewConceptBrand";
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
const WEIGHTS = optionsOf([
  ["400", "Regular"],
  ["500", "Medium"],
  ["600", "Semibold"],
  ["700", "Bold"],
]);

export function NumberField({
  label,
  max,
  onChange,
  step = 1,
  value,
}: {
  label: string;
  max: number;
  onChange: (value: number) => void;
  step?: number;
  value: number;
}) {
  return (
    <ConceptField label={label}>
      <Input
        aria-label={label}
        face="numeric"
        max={max}
        min={0}
        onChange={(event) => onChange(Number(event.target.value))}
        size="sm"
        step={step}
        type="number"
        value={value}
      />
    </ConceptField>
  );
}

/** One named row of the element form: Content, Type, Box or Color. */
function Group({ children, name }: { children: ReactNode; name: string }) {
  return (
    <div className="review-concepts__group">
      <span className="review-concepts__group-name">{name}</span>
      <div className="review-concepts__group-fields">{children}</div>
    </div>
  );
}

function ContentGroup({
  element,
  onChange,
}: {
  element: ReviewConceptElement;
  onChange: (patch: Patch) => void;
}) {
  const checkedId = useId();
  return (
    <Group name="Content">
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
    </Group>
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
  return (
    <section aria-label={element.kind} className="review-concepts__element">
      <header className="review-concepts__element-bar">
        <span>{element.kind}</span>
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
      <ContentGroup element={element} onChange={onChange} />
      <Group name="Type">
        <ConceptFontField
          brandDoc={brandDoc}
          family={element.fontFamily}
          fontId={element.fontId}
          fontRef={element.fontRef}
          label="Typeface"
          onChange={onChange}
        />
        <NumberField
          label={element.kind === "icon" ? "Icon size" : "Size"}
          max={72}
          onChange={(fontSize) => onChange({ fontSize })}
          value={element.fontSize}
        />
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
      </Group>
      <Group name="Box">
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
      </Group>
      <Group name="Color">
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
      </Group>
    </section>
  );
}
