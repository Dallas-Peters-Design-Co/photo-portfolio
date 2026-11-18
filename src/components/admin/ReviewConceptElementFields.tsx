import { ChevronDown, Copy, Trash2 } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef } from "react";
import type { BrandKitDoc } from "../../../config/brandKit.js";
import { takesHover } from "../../../config/conceptHover.js";
import { takesBox, takesIcon } from "../../../config/conceptKinds.js";
import { takesMenu } from "../../../config/conceptMenu.js";
import { hasSlots, MAX_SLOT_DEPTH } from "../../../config/conceptSlots.js";
import type { ConceptStyle } from "../../../config/conceptStyle.js";
import type { ReviewConceptElement } from "../../../config/reviewConcept.js";
import { useRememberedOpen } from "../../hooks/useRememberedOpen";
import { iconLabel } from "../review/ConceptIcon";
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
import { LogoGroup } from "./ConceptLogoFields";
import { MenuGroup } from "./ConceptMenuFields";
import { ConceptSlotFields, SlotFields } from "./ConceptSlotFields";
import { StyleLink } from "./ConceptStyleLink";
import { ConceptTableFields } from "./ConceptTableFields";
import { ConceptTooltipFields } from "./ConceptTooltipFields";
import { CardTypeFields, LineHeightField, WEIGHTS } from "./ConceptTypeFields";
import { useElementFocus } from "./elementFocus";
import { ConceptColorField } from "./ReviewConceptBrand";
import {
  CheckboxGroup,
  ElementIconGroup,
  HoverGroup,
  ProgressGroup,
  ShadowGroup,
  TabsGroup,
  ToastGroup,
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

const SUMMARY_LENGTH = 48;

/** What a folded element says about itself: its first line of text. */
const summaryOf = (element: ReviewConceptElement): string => {
  // An icon-only button says what it is: "Close icon".
  const icon =
    element.iconName && !element.text.trim()
      ? `${iconLabel(element.iconName)} icon`
      : "";
  const text =
    (element.text || element.placeholder || icon).split("\n")[0] ?? "";
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
      {element.kind === "upload" ? (
        <ConceptField label="File after upload (leave empty before)" wide>
          <Input
            aria-label="File after upload"
            onChange={(event) => onChange({ placeholder: event.target.value })}
            placeholder="brief.pdf"
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
      {/* A logo is its picture and a navbar its slots: no text of their own. */}
      {element.kind === "table" ||
      element.kind === "logo" ||
      element.kind === "navbar" ||
      lookOnly ? null : (
        <ContentGroup element={element} onChange={onChange} />
      )}
      {takesHover(element.kind) ? (
        <HoverGroup brandDoc={brandDoc} element={element} onChange={onChange} />
      ) : null}
      {element.kind === "toast" ? (
        <ToastGroup brandDoc={brandDoc} element={element} onChange={onChange} />
      ) : null}
      {element.kind === "logo" ? (
        <LogoGroup brandDoc={brandDoc} element={element} onChange={onChange} />
      ) : null}
      {element.kind === "progress" ? (
        <ProgressGroup
          brandDoc={brandDoc}
          element={element}
          lookOnly={lookOnly}
          onChange={onChange}
        />
      ) : null}
      {takesMenu(element.kind) ? (
        <MenuGroup brandDoc={brandDoc} element={element} onChange={onChange} />
      ) : null}
      {element.kind === "tabs" ? (
        <TabsGroup brandDoc={brandDoc} element={element} onChange={onChange} />
      ) : null}
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
          lookOnly={lookOnly}
          onChange={onChange}
        />
      ) : null}
    </>
  );
}

/** The element's name (the fold control), its kit style, and its actions. */
function ElementBar({
  actions,
  bodyId,
  element,
  handle,
  onDuplicate,
  onLink,
  onRemove,
  onToggle,
  open,
  styles,
}: {
  /** Actions the list offers on this element (group, ungroup). */
  actions?: ReactNode;
  bodyId: string;
  element: ReviewConceptElement;
  /** The control that moves the element within its list. */
  handle?: ReactNode;
  onDuplicate?: () => void;
  onLink?: (style: ConceptStyle | null) => void;
  onRemove?: () => void;
  onToggle: () => void;
  open: boolean;
  styles: ConceptStyle[];
}) {
  return (
    <header className="review-concepts__element-bar">
      {/* The name and quick actions on one line; the kit style on its own
          line below, where its buttons have room. */}
      <div className="review-concepts__element-main">
        {handle}
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
        {actions}
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
      </div>
      {onLink && styles.length > 0 ? (
        <StyleLink element={element} onLink={onLink} styles={styles} />
      ) : null}
    </header>
  );
}

/** What a group or a card or panel holds, and how it lays it out. */
function HolderFields({
  brandDoc,
  depth,
  element,
  onChange,
}: {
  brandDoc?: BrandKitDoc | null;
  depth: number;
  element: ReviewConceptElement;
  onChange: (patch: Patch) => void;
}) {
  if (element.kind === "group") {
    return (
      <SlotFields
        brandDoc={brandDoc}
        depth={depth}
        group
        label="Group"
        listLabel="In the group"
        onChange={(group) => onChange({ group })}
        slot={element.group ?? { elements: [] }}
      />
    );
  }
  return hasSlots(element.kind) && depth < MAX_SLOT_DEPTH ? (
    <ConceptSlotFields
      brandDoc={brandDoc}
      depth={depth}
      element={element}
      onChange={onChange}
    />
  ) : null;
}

/** The element's corner radius and its padding. */
function BoxGroup({
  element,
  onChange,
}: {
  element: ReviewConceptElement;
  onChange: (patch: Patch) => void;
}) {
  return (
    <ConceptGroup name="Box">
      <NumberField
        label="Radius"
        max={48}
        onChange={(radius) => onChange({ radius })}
        value={element.radius}
      />
      {/* A tab's side padding is in the Tabs group, beside the row's. */}
      {element.kind === "tabs" ? null : (
        <NumberField
          label="Padding X"
          max={48}
          onChange={(paddingX) => onChange({ paddingX })}
          value={element.paddingX}
        />
      )}
      <NumberField
        label="Padding Y"
        max={32}
        onChange={(paddingY) => onChange({ paddingY })}
        value={element.paddingY}
      />
    </ConceptGroup>
  );
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: the canvas element has a separate, read-only editor alongside the existing element controls
export function ReviewConceptElementFields({
  actions,
  brandDoc,
  depth = 0,
  element,
  handle,
  lookOnly = false,
  initiallyOpen = false,
  onChange,
  onDuplicate,
  onLink,
  onRemove,
  styles = [],
}: {
  /** Actions the list offers on this element (group, ungroup). */
  actions?: ReactNode;
  brandDoc?: BrandKitDoc | null;
  /** How many slots deep the element sits; past the limit it has none. */
  depth?: number;
  element: ReviewConceptElement;
  /** The control that moves the element within its list. */
  handle?: ReactNode;
  /**
   * The brand kit's style editor: only the look (type, box, border, shadow,
   * colour, a table's header and borders), none of the content.
   */
  lookOnly?: boolean;
  /** Open this control by default even when it sits in a slot. */
  initiallyOpen?: boolean;
  onChange: (patch: Patch) => void;
  onDuplicate?: () => void;
  /** Follow a kit style, or (null) stop following one. */
  onLink?: (style: ConceptStyle | null) => void;
  onRemove?: () => void;
  /** The kit styles this element could follow: those of its kind. */
  styles?: ConceptStyle[];
}) {
  // Elements inside a slot start folded, so a panel's list stays short.
  // Each is remembered after it is first opened or folded.
  const [open, setOpen] = useRememberedOpen(
    `concept-element:${element.id}`,
    depth === 0 || initiallyOpen
  );
  const bodyId = useId();
  // Picked in the preview: open, and if it's the one picked, scroll to it.
  const focus = useElementFocus();
  const section = useRef<HTMLElement>(null);
  const inPath = focus.path.has(element.id);
  const picked = focus.target === element.id;
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a new pick (nonce) acts
  useEffect(() => {
    if (!inPath) {
      return;
    }
    setOpen(true);
    if (picked) {
      requestAnimationFrame(() =>
        section.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      );
    }
  }, [focus.nonce]);
  if (element.kind === "canvas") {
    return (
      <section
        aria-label="canvas component"
        className="review-concepts__element"
        data-picked={picked || undefined}
        ref={section}
      >
        <ElementBar
          actions={actions}
          bodyId={bodyId}
          element={element}
          handle={handle}
          onDuplicate={onDuplicate}
          onRemove={onRemove}
          onToggle={() => setOpen(!open)}
          open={open}
          styles={[]}
        />
        {open ? (
          <div id={bodyId}>
            <p>
              The component is saved with this review. Edit the original on the
              canvas, then insert it again to use its latest version.
            </p>
            <ConceptTooltipFields
              brandDoc={brandDoc}
              element={element}
              onChange={onChange}
            />
          </div>
        ) : null}
      </section>
    );
  }
  return (
    <section
      aria-label={element.kind}
      className="review-concepts__element"
      data-picked={picked || undefined}
      ref={section}
    >
      {lookOnly ? null : (
        <ElementBar
          actions={actions}
          bodyId={bodyId}
          element={element}
          handle={handle}
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
          {!lookOnly && element.kind !== "tooltip" ? (
            <ConceptTooltipFields
              brandDoc={brandDoc}
              element={element}
              onChange={onChange}
            />
          ) : null}
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
              <CardTypeFields element={element} onChange={onChange} />
            ) : null}
            <ConceptField
              label={element.kind === "card" ? "Body weight" : "Weight"}
            >
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
            <LineHeightField element={element} onChange={onChange} />
          </ConceptGroup>
          <BoxGroup element={element} onChange={onChange} />
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
              label={element.kind === "progress" ? "Track" : "Fill"}
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
          {/* In the kit, a panel's or card's starting items are set here too
              (ConceptStyleLook.contents). */}
          {lookOnly && !hasSlots(element.kind) ? null : (
            <HolderFields
              brandDoc={brandDoc}
              depth={depth}
              element={element}
              onChange={onChange}
            />
          )}
        </div>
      ) : null}
    </section>
  );
}
