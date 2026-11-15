import { ChevronDown, Copy, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import type { BrandKitDoc } from "../../../config/brandKit.js";
import type { ConceptStyle } from "../../../config/conceptStyle.js";
import {
  type ReviewConceptElement,
  takesBox,
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
import { ConceptTableFields } from "./ConceptTableFields";
import { ConceptColorField } from "./ReviewConceptBrand";
import {
  CheckboxGroup,
  ElementIconGroup,
  ShadowGroup,
} from "./ReviewConceptCardFields";
import { ReviewConceptContentField } from "./ReviewConceptContentField";

type Patch = Partial<ReviewConceptElement>;

const OPTION_KINDS = new Set(["select", "tabs", "menu"]);
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

const CUSTOM = "custom";

/**
 * Which kit style the element follows, and how many settings it has set
 * itself; Reset hands those back to the style.
 */
function StyleLink({
  element,
  onLink,
  styles,
}: {
  element: ReviewConceptElement;
  onLink: (style: ConceptStyle | null) => void;
  styles: ConceptStyle[];
}) {
  const linked = styles.find((style) => style.id === element.styleId) ?? null;
  const own = element.overrides?.length ?? 0;
  return (
    <div className="review-concepts__style-link">
      {linked && own > 0 ? (
        <Button
          onClick={() => onLink(linked)}
          size="xs"
          title="Hand these settings back to the kit style"
          type="button"
          variant="ghost"
        >
          {own} {own === 1 ? "change" : "changes"} · Reset
        </Button>
      ) : null}
      <div className="review-concepts__style-pick">
        <ConceptSelect
          label={`${element.kind} style`}
          onChange={(id) =>
            onLink(styles.find((style) => style.id === id) ?? null)
          }
          options={[
            { label: "Custom", value: CUSTOM },
            ...styles.map((style) => ({ label: style.name, value: style.id })),
          ]}
          value={linked?.id ?? CUSTOM}
        />
      </div>
    </div>
  );
}

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

/**
 * What only some kinds have, above the shared look: a table's columns, rows,
 * header and borders; the content of the rest; a checkbox's box; an icon.
 */
function KindGroups({
  brandDoc,
  element,
  lookOnly,
  onChange,
}: {
  brandDoc?: BrandKitDoc | null;
  element: ReviewConceptElement;
  lookOnly: boolean;
  onChange: (patch: Patch) => void;
}) {
  return (
    <>
      {/* A table's content is its columns and rows. */}
      {element.kind === "table" ? (
        <ConceptTableFields
          brandDoc={brandDoc}
          element={element}
          lookOnly={lookOnly}
          onChange={onChange}
        />
      ) : null}
      {element.kind === "table" || lookOnly ? null : (
        <ContentGroup element={element} onChange={onChange} />
      )}
      {element.kind === "checkbox" ? (
        <CheckboxGroup
          brandDoc={brandDoc}
          element={element}
          onChange={onChange}
        />
      ) : null}
      {takesIcon(element.kind) ? (
        <ElementIconGroup
          brandDoc={brandDoc}
          element={element}
          onChange={onChange}
        />
      ) : null}
    </>
  );
}

/** The element's name (the fold control), its kit style, and its actions. */
function ElementBar({
  bodyId,
  element,
  onDuplicate,
  onLink,
  onRemove,
  onToggle,
  open,
  styles,
}: {
  bodyId: string;
  element: ReviewConceptElement;
  onDuplicate?: () => void;
  onLink?: (style: ConceptStyle | null) => void;
  onRemove?: () => void;
  onToggle: () => void;
  open: boolean;
  styles: ConceptStyle[];
}) {
  return (
    <header className="review-concepts__element-bar">
      <button
        aria-controls={bodyId}
        aria-expanded={open}
        className="review-concepts__element-toggle"
        onClick={onToggle}
        type="button"
      >
        <ChevronDown aria-hidden size={14} />
        <span>{element.kind}</span>
        {open ? null : <small>{summaryOf(element)}</small>}
      </button>
      {onLink && styles.length > 0 ? (
        <StyleLink element={element} onLink={onLink} styles={styles} />
      ) : null}
      {onDuplicate ? (
        <Button
          aria-label={`Duplicate ${element.kind}`}
          onClick={onDuplicate}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <Copy size={13} />
        </Button>
      ) : null}
      {onRemove ? (
        <Button
          aria-label={`Remove ${element.kind}`}
          onClick={onRemove}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <Trash2 size={13} />
        </Button>
      ) : null}
    </header>
  );
}

export function ReviewConceptElementFields({
  brandDoc,
  element,
  lookOnly = false,
  onChange,
  onDuplicate,
  onLink,
  onRemove,
  styles = [],
}: {
  brandDoc?: BrandKitDoc | null;
  element: ReviewConceptElement;
  /**
   * The brand kit's style editor: only the look (type, box, border, shadow,
   * colour, a table's header and borders), none of the content.
   */
  lookOnly?: boolean;
  onChange: (patch: Patch) => void;
  onDuplicate?: () => void;
  /** Follow a kit style, or (null) stop following one. */
  onLink?: (style: ConceptStyle | null) => void;
  onRemove?: () => void;
  /** The kit styles this element could follow: those of its kind. */
  styles?: ConceptStyle[];
}) {
  const [open, setOpen] = useState(true);
  const bodyId = useId();
  return (
    <section aria-label={element.kind} className="review-concepts__element">
      {lookOnly ? null : (
        <ElementBar
          bodyId={bodyId}
          element={element}
          onDuplicate={onDuplicate}
          onLink={onLink}
          onRemove={onRemove}
          onToggle={() => setOpen(!open)}
          open={open}
          styles={styles}
        />
      )}
      {open || lookOnly ? (
        <div className="review-concepts__element-body" id={bodyId}>
          <KindGroups
            brandDoc={brandDoc}
            element={element}
            lookOnly={lookOnly}
            onChange={onChange}
          />
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
          {takesBox(element.kind) ? (
            <ShadowGroup
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
            <ConceptColorField
              allowNone
              ariaLabel={`${element.kind} background`}
              brandDoc={brandDoc}
              label="Fill"
              onChange={(background) => onChange({ background })}
              value={element.background}
            />
          </ConceptGroup>
          {takesBox(element.kind) ? (
            <ConceptGroup name="Border">
              <ConceptColorField
                allowNone
                ariaLabel={`${element.kind} border color`}
                brandDoc={brandDoc}
                label="Color"
                onChange={(borderColor) => onChange({ borderColor })}
                value={element.borderColor ?? "transparent"}
              />
              <NumberField
                label="Width"
                max={8}
                onChange={(borderWidth) => onChange({ borderWidth })}
                value={element.borderWidth ?? 1}
              />
            </ConceptGroup>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
