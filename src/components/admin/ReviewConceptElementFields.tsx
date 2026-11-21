import { ChevronDown, Copy, Trash2 } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef } from "react";
import type { BrandKitDoc } from "../../../config/brandKit.js";
import { takesFocus } from "../../../config/conceptFocus.js";
import { takesHover } from "../../../config/conceptHover.js";
import { takesBox, takesIcon } from "../../../config/conceptKinds.js";
import { takesMenu } from "../../../config/conceptMenu.js";
import { hasSlots, MAX_SLOT_DEPTH } from "../../../config/conceptSlots.js";
import {
  type ConceptStyle,
  type ConceptStyleProp,
  componentPropOptionsForKind,
  componentPropsOf,
} from "../../../config/conceptStyle.js";
import type { ReviewConceptElement } from "../../../config/reviewConcept.js";
import { useRememberedOpen } from "../../hooks/useRememberedOpen";
import { iconLabel } from "../review/ConceptIcon";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { ComponentStyleClipboard } from "./ComponentStyleClipboard";
import { ConceptAvatarFields } from "./ConceptAvatarFields";
import { BoxGroup } from "./ConceptBoxFields";
import {
  ConceptField,
  ConceptGroup,
  ConceptSelect,
  NumberField,
  optionsOf,
} from "./ConceptControls";
import { LayerListBoundary } from "./ConceptElementList";
import { ConceptFlexFields } from "./ConceptFlexFields";
import { ConceptFontField } from "./ConceptFontField";
import { ConceptGridItemFields } from "./ConceptGridItemFields";
import { LogoGroup } from "./ConceptLogoFields";
import { MenuGroup } from "./ConceptMenuFields";
import { ConceptSlotFields, SlotFields } from "./ConceptSlotFields";
import { StyleLink, StylePicker } from "./ConceptStyleLink";
import { ConceptTableFields } from "./ConceptTableFields";
import { ConceptTooltipFields } from "./ConceptTooltipFields";
import { CardTypeFields, LineHeightField, WEIGHTS } from "./ConceptTypeFields";
import { useElementFocus } from "./elementFocus";
import { ConceptColorField } from "./ReviewConceptBrand";
import {
  CheckboxGroup,
  ElementIconGroup,
  FocusGroup,
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
const BORDER_WIDTH_FIELDS = [
  ["borderTopWidth", "Top"],
  ["borderLeftWidth", "Left"],
  ["borderRightWidth", "Right"],
  ["borderBottomWidth", "Bottom"],
] as const;

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

function EditableContent({
  canEditProp,
  element,
  onChange,
}: {
  canEditProp: (prop: ConceptStyleProp) => boolean;
  element: ReviewConceptElement;
  onChange: (patch: Patch) => void;
}) {
  const showCardTitle =
    element.kind === "card" && (canEditProp("title") || canEditProp("text"));
  const showCardBody =
    element.kind === "card" && (canEditProp("body") || canEditProp("text"));
  const showText =
    element.kind === "card"
      ? showCardTitle || showCardBody
      : canEditProp("text");
  return showText ? (
    <ReviewConceptContentField
      element={element}
      onChange={onChange}
      showBody={showCardBody}
      showTitle={showCardTitle}
    />
  ) : null;
}

function ContentGroup({
  canEditProp,
  element,
  onChange,
}: {
  canEditProp: (prop: ConceptStyleProp) => boolean;
  element: ReviewConceptElement;
  onChange: (patch: Patch) => void;
}) {
  const checkedId = useId();
  const supportsPlaceholder = ["input", "textarea", "select"].includes(
    element.kind
  );
  const showPlaceholder =
    canEditProp("placeholder") &&
    (supportsPlaceholder || element.kind === "upload");
  return (
    <ConceptGroup name="Content">
      <EditableContent
        canEditProp={canEditProp}
        element={element}
        onChange={onChange}
      />
      {showPlaceholder && element.kind !== "upload" ? (
        <ConceptField label="Placeholder" wide>
          <Input
            aria-label="Placeholder"
            onChange={(event) => onChange({ placeholder: event.target.value })}
            size="sm"
            value={element.placeholder ?? ""}
          />
        </ConceptField>
      ) : null}
      {showPlaceholder && element.kind === "upload" ? (
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
      {OPTION_KINDS.has(element.kind) && canEditProp("options") ? (
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
      {element.kind === "input" && canEditProp("inputType") ? (
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
      {element.kind === "checkbox" && canEditProp("checked") ? (
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
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: each conditional is a separate component capability and prop gate
function KindGroups({
  brandDoc,
  canEditAnyProp,
  canEditProp,
  element,
  lookOnly,
  onChange,
}: {
  brandDoc?: BrandKitDoc | null;
  canEditAnyProp: (...props: ConceptStyleProp[]) => boolean;
  canEditProp: (prop: ConceptStyleProp) => boolean;
  element: ReviewConceptElement;
  lookOnly: boolean;
  onChange: (patch: Patch) => void;
}) {
  return (
    <>
      {/* A table's content is its columns and rows. */}
      {element.kind === "table" &&
      (canEditProp("tableContents") ||
        canEditProp("tableBorders") ||
        canEditProp("tableHeader")) ? (
        <ConceptTableFields
          brandDoc={brandDoc}
          element={element}
          onChange={onChange}
          showBorders={canEditProp("tableBorders")}
          showContents={canEditProp("tableContents")}
          showHeader={canEditProp("tableHeader")}
        />
      ) : null}
      {/* A logo is its picture and a navbar its slots: no text of their own. */}
      {element.kind === "table" ||
      element.kind === "text" ||
      element.kind === "avatar" ||
      element.kind === "logo" ||
      element.kind === "navbar" ||
      lookOnly ||
      !canEditAnyProp(
        "text",
        "title",
        "body",
        "placeholder",
        "options",
        "inputType",
        "checked"
      ) ? null : (
        <ContentGroup
          canEditProp={canEditProp}
          element={element}
          onChange={onChange}
        />
      )}
      {takesHover(element.kind) && canEditProp("hover") ? (
        <HoverGroup brandDoc={brandDoc} element={element} onChange={onChange} />
      ) : null}
      {takesFocus(element.kind) && canEditProp("focus") ? (
        <FocusGroup brandDoc={brandDoc} element={element} onChange={onChange} />
      ) : null}
      {element.kind === "toast" &&
      canEditAnyProp("toastAction", "toastClose", "accentColor") ? (
        <ToastGroup
          brandDoc={brandDoc}
          element={element}
          onChange={onChange}
          showAccent={canEditProp("accentColor")}
          showAction={canEditProp("toastAction")}
          showClose={canEditProp("toastClose")}
        />
      ) : null}
      {element.kind === "avatar" &&
      canEditAnyProp("avatarUrl", "avatarInitials") ? (
        <ConceptAvatarFields
          element={element}
          key={element.id}
          onChange={onChange}
          showImage={canEditProp("avatarUrl")}
          showInitials={canEditProp("avatarInitials")}
        />
      ) : null}
      {element.kind === "logo" && canEditAnyProp("logoUrl", "logoHeight") ? (
        <LogoGroup
          brandDoc={brandDoc}
          element={element}
          onChange={onChange}
          showHeight={canEditProp("logoHeight")}
          showLogo={canEditProp("logoUrl")}
        />
      ) : null}
      {element.kind === "progress" &&
      canEditAnyProp("progress", "barHeight", "accentColor", "showValue") ? (
        <ProgressGroup
          brandDoc={brandDoc}
          element={element}
          lookOnly={lookOnly}
          onChange={onChange}
          showAccent={canEditProp("accentColor")}
          showHeight={canEditProp("barHeight")}
          showProgress={canEditProp("progress")}
          showValue={canEditProp("showValue")}
        />
      ) : null}
      {takesMenu(element.kind) && canEditProp("menuLook") ? (
        <MenuGroup brandDoc={brandDoc} element={element} onChange={onChange} />
      ) : null}
      {element.kind === "tabs" && canEditProp("tabLook") ? (
        <TabsGroup brandDoc={brandDoc} element={element} onChange={onChange} />
      ) : null}
      {element.kind === "checkbox" &&
      canEditAnyProp("accentColor", "checkSize") ? (
        <CheckboxGroup
          brandDoc={brandDoc}
          element={element}
          onChange={onChange}
          showAccent={canEditProp("accentColor")}
          showSize={canEditProp("checkSize")}
        />
      ) : null}
      {takesIcon(element.kind) &&
      canEditAnyProp(
        "iconName",
        "iconSvg",
        "iconEndName",
        "iconEndSvg",
        "summaryIconName",
        "summaryIconSvg",
        "iconSize",
        "iconColor"
      ) ? (
        <ElementIconGroup
          brandDoc={brandDoc}
          element={element}
          lookOnly={lookOnly}
          onChange={onChange}
          showColor={canEditProp("iconColor")}
          showEndIcon={canEditProp("iconEndName") || canEditProp("iconEndSvg")}
          showIcon={canEditProp("iconName") || canEditProp("iconSvg")}
          showSize={canEditProp("iconSize")}
          showSummaryIcon={
            canEditProp("summaryIconName") || canEditProp("summaryIconSvg")
          }
        />
      ) : null}
    </>
  );
}

/** What a group or a card or panel holds, and how it lays it out. */
function HolderFields({
  brandDoc,
  canEditProp,
  depth,
  element,
  showAllProps,
  onChange,
}: {
  brandDoc?: BrandKitDoc | null;
  canEditProp: (prop: ConceptStyleProp) => boolean;
  depth: number;
  element: ReviewConceptElement;
  showAllProps: boolean;
  onChange: (patch: Patch) => void;
}) {
  const wrap = (body: ReactNode) => (
    <LayerListBoundary
      elements={[element]}
      onChange={([next]) => onChange({ group: next.group, slots: next.slots })}
    >
      {body}
    </LayerListBoundary>
  );
  if (element.kind === "group") {
    return wrap(
      <SlotFields
        brandDoc={brandDoc}
        depth={depth}
        group
        label="Group"
        listLabel="In the group"
        onChange={(group) => onChange({ group })}
        ownerId={element.id}
        showAllProps={showAllProps}
        slot={element.group ?? { elements: [] }}
      />
    );
  }
  return hasSlots(element.kind) && depth < MAX_SLOT_DEPTH
    ? wrap(
        <ConceptSlotFields
          brandDoc={brandDoc}
          canEditProp={canEditProp}
          depth={depth}
          element={element}
          onChange={onChange}
          showAllProps={showAllProps}
        />
      )
    : null;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: the canvas element has a separate, read-only editor alongside the existing element controls
export function ReviewConceptElementFields({
  actions,
  brandDoc,
  depth = 0,
  element,
  gridColumns,
  handle,
  lookOnly = false,
  showAllProps = false,
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
  /** When the parent is a grid, allow explicit cell placement. */
  gridColumns?: number;
  /** The control that moves the element within its list. */
  handle?: ReactNode;
  /**
   * The brand kit's style editor: only the look (type, box, border, shadow,
   * colour, a table's header and borders), none of the content.
   */
  lookOnly?: boolean;
  /** All controls for a component nested in a kit component's slots. */
  showAllProps?: boolean;
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
  const linkedStyle = styles.find((style) => style.id === element.styleId);
  const allowedProps = new Set<ConceptStyleProp>(
    linkedStyle
      ? componentPropsOf(linkedStyle)
      : componentPropOptionsForKind(element.kind)
  );
  const canEditProp = (prop: ConceptStyleProp) =>
    lookOnly || showAllProps || allowedProps.has(prop);
  const canEditAnyProp = (...props: ConceptStyleProp[]) =>
    props.some(canEditProp);
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
  const linkStyle = element.kind !== "canvas" && onLink;
  const header = (
    <header className="review-concepts__element-main">
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
      {linkStyle ? (
        <StylePicker element={element} onLink={linkStyle} styles={styles} />
      ) : null}
    </header>
  );
  const footer = (
    <footer className="review-concepts__element-footer">
      {handle}
      {actions}
      {element.kind === "canvas" ? null : (
        <ComponentStyleClipboard element={element} onChange={onChange} />
      )}
      {onDuplicate ? (
        <Button
          aria-label={`Duplicate ${element.kind}`}
          onClick={onDuplicate}
          size="icon-sm"
          title={`Duplicate ${element.kind}`}
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
          title={`Remove ${element.kind}`}
          type="button"
          variant="ghost"
        >
          <Trash2 size={13} />
        </Button>
      ) : null}
      {linkStyle ? (
        <StyleLink element={element} onLink={linkStyle} styles={styles} />
      ) : null}
    </footer>
  );
  if (element.kind === "canvas") {
    return (
      <section
        aria-label="canvas component"
        className="review-concepts__element"
        data-picked={picked || undefined}
        ref={section}
      >
        {header}
        {open ? (
          <div id={bodyId}>
            <p>
              The component is saved with this review. Edit the original on the
              canvas, then insert it again to use its latest version.
            </p>
            <ConceptFlexFields
              flex={element.flex}
              onChange={(flex) => onChange({ flex })}
            />
            <ConceptTooltipFields
              brandDoc={brandDoc}
              element={element}
              onChange={onChange}
            />
          </div>
        ) : null}
        {Boolean(handle || actions || onDuplicate || onRemove) && footer}
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
      {!lookOnly && header}
      {element.kind === "text" && !lookOnly && canEditProp("text") ? (
        <ReviewConceptContentField element={element} onChange={onChange} />
      ) : null}
      {open || lookOnly ? (
        <div className="review-concepts__element-body" id={bodyId}>
          {!lookOnly && element.kind !== "tooltip" && canEditProp("tooltip") ? (
            <ConceptTooltipFields
              brandDoc={brandDoc}
              element={element}
              onChange={onChange}
            />
          ) : null}
          {canEditProp("flex") ? (
            <ConceptFlexFields
              flex={element.flex}
              onChange={(flex) => onChange({ flex })}
            />
          ) : null}
          {gridColumns ? (
            <ConceptGridItemFields
              columns={gridColumns}
              onChange={(gridPlacement) => onChange({ gridPlacement })}
              placement={element.gridPlacement}
            />
          ) : null}
          <KindGroups
            brandDoc={brandDoc}
            canEditAnyProp={canEditAnyProp}
            canEditProp={canEditProp}
            element={element}
            lookOnly={lookOnly}
            onChange={onChange}
          />
          {canEditAnyProp(
            "fontFamily",
            "fontId",
            "fontRef",
            "fontSize",
            "fontWeight",
            "lineHeight",
            "bodySize",
            "titleWeight"
          ) ? (
            <ConceptGroup compact name="Type">
              {canEditAnyProp("fontFamily", "fontId", "fontRef") ? (
                <ConceptFontField
                  brandDoc={brandDoc}
                  family={element.fontFamily}
                  fontId={element.fontId}
                  fontRef={element.fontRef}
                  label="Typeface"
                  onChange={onChange}
                />
              ) : null}
              {canEditProp("fontSize") ? (
                <NumberField
                  label={SIZE_LABELS[element.kind] ?? "Size"}
                  max={72}
                  onChange={(fontSize) => onChange({ fontSize })}
                  value={element.fontSize}
                />
              ) : null}
              {element.kind === "card" &&
              (canEditProp("bodySize") || canEditProp("titleWeight")) ? (
                <CardTypeFields
                  element={element}
                  onChange={onChange}
                  showBodySize={canEditProp("bodySize")}
                  showTitleWeight={canEditProp("titleWeight")}
                />
              ) : null}
              {canEditProp("fontWeight") ? (
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
              ) : null}
              {canEditProp("lineHeight") ? (
                <LineHeightField element={element} onChange={onChange} />
              ) : null}
            </ConceptGroup>
          ) : null}
          <BoxGroup
            element={element}
            onChange={onChange}
            showFullHeight={canEditProp("fullHeight")}
            showPaddingX={canEditProp("paddingX")}
            showPaddingY={canEditProp("paddingY")}
            showRadius={canEditProp("radius")}
          />
          {takesBox(element.kind) && canEditProp("shadow") ? (
            <ShadowGroup
              brandDoc={brandDoc}
              element={element}
              onChange={onChange}
            />
          ) : null}
          {canEditAnyProp("color", "background") ? (
            <ConceptGroup compact name="Color">
              {canEditProp("color") ? (
                <ConceptColorField
                  ariaLabel={`${element.kind} text color`}
                  brandDoc={brandDoc}
                  label="Text"
                  onChange={(color) => onChange({ color })}
                  value={element.color}
                />
              ) : null}
              {canEditProp("background") ? (
                <ConceptColorField
                  allowNone
                  ariaLabel={`${element.kind} background`}
                  brandDoc={brandDoc}
                  label={element.kind === "progress" ? "Track" : "Fill"}
                  onChange={(background) => onChange({ background })}
                  value={element.background}
                />
              ) : null}
            </ConceptGroup>
          ) : null}
          {takesBox(element.kind) &&
          canEditAnyProp(
            "borderColor",
            "borderWidth",
            ...BORDER_WIDTH_FIELDS.map(([key]) => key)
          ) ? (
            <ConceptGroup compact name="Border">
              {canEditProp("borderColor") ? (
                <ConceptColorField
                  allowNone
                  ariaLabel={`${element.kind} border color`}
                  brandDoc={brandDoc}
                  label="Color"
                  onChange={(borderColor) => onChange({ borderColor })}
                  value={element.borderColor ?? "transparent"}
                />
              ) : null}
              {BORDER_WIDTH_FIELDS.filter(
                ([key]) => canEditProp(key) || canEditProp("borderWidth")
              ).map(([key, label]) => (
                <NumberField
                  key={key}
                  label={label}
                  max={8}
                  min={0}
                  onChange={(value) => onChange({ [key]: value })}
                  value={element[key] ?? element.borderWidth ?? 1}
                />
              ))}
            </ConceptGroup>
          ) : null}
          {/* In the kit, a panel's or card's starting items are set here too
              (ConceptStyleLook.contents). */}
          {lookOnly &&
          !hasSlots(element.kind) &&
          element.kind !== "group" ? null : (
            <HolderFields
              brandDoc={brandDoc}
              canEditProp={canEditProp}
              depth={depth}
              element={element}
              onChange={onChange}
              showAllProps={lookOnly || showAllProps}
            />
          )}
        </div>
      ) : null}
      {!lookOnly && footer}
    </section>
  );
}
