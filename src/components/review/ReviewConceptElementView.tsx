import { ChevronDown } from "lucide-react";
import type { CSSProperties } from "react";
import { conceptFontStack } from "../../../config/conceptFont.js";
import { iconSizeOf, takesBox } from "../../../config/conceptKinds.js";
import { shadowCss, shadowOf } from "../../../config/conceptShadow.js";
import {
  type ReviewConceptElement,
  splitCardText,
} from "../../../config/reviewConcept.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { ConceptHover } from "./ConceptHover";
import { ConceptIcon, ConceptIconText } from "./ConceptIcon";
import { conceptMenuProps } from "./conceptMenuStyle";
import "./ConceptElements.css";
import { ConceptPanelPreview } from "./ConceptPanelPreview";
import { ConceptProgressPreview } from "./ConceptProgressPreview";
import { ConceptGroupView, ConceptSlotsView } from "./ConceptSlotsView";
import { ConceptTablePreview } from "./ConceptTablePreview";
import { ConceptTabsPreview } from "./ConceptTabsPreview";
import { ConceptToastPreview } from "./ConceptToastPreview";
import { ConceptUploadPreview } from "./ConceptUploadPreview";
import { useConceptFont } from "./useConceptFont";

const ICON_SUFFIX = /Icon$/;

function CardPreview({
  element,
  style,
}: {
  element: ReviewConceptElement;
  style: CSSProperties;
}) {
  const card = splitCardText(element.text);
  // The card's own icon, title and body lead its header slot, so whatever
  // the header holds sits beside them, across the card's full width. With
  // none of them, there is no lead, and the header holds only its elements.
  // Blank text (a space typed to clear the title) counts as none.
  const title = card.title.trim();
  const body = card.body.trim();
  const hasLead = Boolean(element.iconName || title || body);
  const lead = hasLead ? (
    <div className="concept-slot__lead review-concepts__card-text">
      {element.iconName ? (
        <ConceptIcon
          color={element.iconColor}
          name={element.iconName}
          size={iconSizeOf(element)}
          svg={element.iconSvg}
        />
      ) : null}
      {title ? (
        <strong style={{ fontWeight: element.titleWeight }}>
          {card.title}
        </strong>
      ) : null}
      {body ? (
        // Cards saved before bodySize existed keep one size for both.
        <p style={{ fontSize: element.bodySize ?? element.fontSize }}>
          {card.body}
        </p>
      ) : null}
    </div>
  ) : undefined;
  return (
    <article className="review-concepts__card-preview" style={style}>
      <ConceptSlotsView
        dividers={element.dividers}
        draw={drawElement}
        lead={lead}
        slots={element.slots}
      />
    </article>
  );
}

/**
 * An input, with its icon inside the field when it has one: the box carries
 * the input's look, and the bare text field sits beside the icon within it.
 */
function InputPreview({
  element,
  style,
  text,
}: {
  element: ReviewConceptElement;
  style: CSSProperties;
  text: string;
}) {
  const field = (
    <input
      aria-label={element.placeholder || text}
      placeholder={element.placeholder}
      readOnly
      style={element.iconName ? BARE_FIELD : style}
      type={element.inputType ?? "text"}
      value={element.text}
    />
  );
  if (!element.iconName) {
    return field;
  }
  return (
    <span
      style={{
        ...style,
        alignItems: "center",
        display: "inline-flex",
        gap: Math.round(element.fontSize * 0.5),
      }}
    >
      <ConceptIcon
        color={element.iconColor}
        name={element.iconName}
        size={iconSizeOf(element)}
        svg={element.iconSvg}
      />
      {field}
    </span>
  );
}

/**
 * A select drawn with the project's own Select, so it opens and reads the way
 * the site's menus do. The element's colours, type, padding and corners still
 * apply: the preview shows the design, the component supplies the behaviour.
 * The text is the placeholder, as it was on the old native menu.
 */
function SelectPreview({
  element,
  style,
  text,
}: {
  element: ReviewConceptElement;
  style: CSSProperties;
  text: string;
}) {
  const options = element.options ?? [];
  // The element's text is what the select shows, as a chosen value — not a
  // placeholder, which the Select draws at 60% and which made a select look
  // faded beside an input in the same look.
  return (
    <Select
      defaultValue={text}
      items={Object.fromEntries(
        [text, ...options].map((option) => [option, option])
      )}
    >
      <SelectTrigger
        aria-label={text}
        style={{ ...style, height: "auto" }}
        tone="inherit"
        width="fit"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent {...conceptMenuProps(element)}>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * A dropdown menu drawn with the project's DropdownMenu: a button in the
 * element's own look that opens the menu of its options.
 */
function MenuPreview({
  element,
  style,
  text,
}: {
  element: ReviewConceptElement;
  style: CSSProperties;
  text: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        style={{
          ...style,
          alignItems: "center",
          cursor: "pointer",
          display: "inline-flex",
          gap: Math.round(element.fontSize * 0.4),
        }}
      >
        {text}
        <ChevronDown aria-hidden size={element.fontSize} />
      </DropdownMenuTrigger>
      <DropdownMenuContent {...conceptMenuProps(element)}>
        {(element.options ?? [text]).map((option) => (
          <DropdownMenuItem key={option}>{option}</DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The text field inside an input's box: no box of its own. */
const BARE_FIELD: CSSProperties = {
  background: "transparent",
  border: 0,
  color: "inherit",
  flex: 1,
  font: "inherit",
  minWidth: 0,
  outline: "none",
  padding: 0,
};

/** Fields drawn with a faint outline until they are given a border. */
const OUTLINED = new Set(["input", "select", "textarea"]);
const FAINT_OUTLINE =
  "1px solid color-mix(in srgb, currentColor 25%, transparent)";

/**
 * A box element's border and shadow: its own border when set, else a field's
 * faint outline (a card's comes from its stylesheet); its shadow, else none
 * (a card's soft one).
 */
const boxOf = (element: ReviewConceptElement): CSSProperties => {
  if (!takesBox(element.kind)) {
    return {};
  }
  let border: string | undefined;
  if (element.borderColor) {
    border = `${element.borderWidth ?? 1}px solid ${element.borderColor}`;
  } else if (OUTLINED.has(element.kind)) {
    border = FAINT_OUTLINE;
  }
  return { border, boxShadow: shadowCss(shadowOf(element)) };
};

function ElementBody({ element }: { element: ReviewConceptElement }) {
  useConceptFont(element.fontFamily, element.fontRef, element.fontId);
  const style: CSSProperties = {
    background: element.background,
    ...boxOf(element),
    borderRadius: element.radius,
    boxSizing: "border-box",
    color: element.color,
    fontFamily: conceptFontStack(
      element.fontFamily,
      element.fontRef,
      element.fontId
    ),
    fontSize: element.fontSize,
    fontWeight: element.fontWeight,
    lineHeight: element.lineHeight,
    padding: `${element.paddingY}px ${element.paddingX}px`,
  };
  const text = element.text || (element.kind === "button" ? "Button" : "Text");

  switch (element.kind) {
    case "icon": {
      const iconName = element.iconName ?? "StarIcon";
      return (
        <span
          aria-label={`${iconName.replace(ICON_SUFFIX, "")} icon`}
          role="img"
          style={{
            ...style,
            alignItems: "center",
            display: "inline-flex",
            justifyContent: "center",
            lineHeight: 0,
          }}
        >
          <ConceptIcon
            name={iconName}
            size={element.fontSize}
            svg={element.iconSvg}
          />
        </span>
      );
    }
    case "button":
      return <ConceptIconText as="button" element={element} style={style} />;
    case "input":
      return <InputPreview element={element} style={style} text={text} />;
    case "textarea":
      return (
        <textarea
          aria-label={element.placeholder || "Text area"}
          placeholder={element.placeholder}
          readOnly
          rows={3}
          style={style}
          value={element.text}
        />
      );
    case "select":
      return <SelectPreview element={element} style={style} text={text} />;
    case "checkbox":
      return (
        <label className="review-concepts__checkbox-preview" style={style}>
          <input
            checked={element.checked ?? false}
            readOnly
            style={{
              accentColor: element.accentColor,
              height: element.checkSize,
              margin: 0,
              width: element.checkSize,
            }}
            type="checkbox"
          />
          {text}
        </label>
      );
    case "card":
      return <CardPreview element={element} style={style} />;
    case "label":
      return <span style={style}>{text}</span>;
    case "badge":
    case "tag":
      return <ConceptIconText as="span" element={element} style={style} />;
    case "link":
      return (
        <button
          style={{
            ...style,
            border: 0,
            cursor: "pointer",
            font: "inherit",
            textDecoration: "underline",
          }}
          type="button"
        >
          {text}
        </button>
      );
    case "divider":
      return (
        <hr
          style={{
            border: 0,
            borderTop: `1px solid ${element.color}`,
            margin: 0,
            width: "100%",
          }}
        />
      );
    case "tabs":
      return <ConceptTabsPreview element={element} style={style} text={text} />;
    case "table":
      return <ConceptTablePreview element={element} style={style} />;
    case "dialog":
      return (
        <section
          aria-label="Dialog preview"
          className="review-concepts__dialog-preview"
          style={style}
        >
          <strong>{text}</strong>
          <p>Supporting details and a clear next step.</p>
          <div>
            <button type="button">Cancel</button>
            <button type="button">Confirm</button>
          </div>
        </section>
      );
    case "menu":
      return <MenuPreview element={element} style={style} text={text} />;
    case "group":
      return (
        <ConceptGroupView draw={drawElement} element={element} style={style} />
      );
    case "upload":
      return <ConceptUploadPreview element={element} style={style} />;
    case "toast":
      return (
        <ConceptToastPreview element={element} style={style} text={text} />
      );
    case "panel":
      return (
        <ConceptPanelPreview
          draw={drawElement}
          element={element}
          style={style}
        />
      );
    case "progress":
      return <ConceptProgressPreview element={element} style={style} />;
    case "skeleton":
      return (
        <div
          aria-label="Loading placeholder preview"
          className="review-concepts__skeleton-preview"
          role="status"
        >
          <span />
          <span />
          <span />
        </div>
      );
    default:
      return <div style={{ ...style, whiteSpace: "pre-line" }}>{text}</div>;
  }
}

/** An element as a concept draws it, with its hover look when it has one. */
export function ReviewConceptElementView({
  element,
}: {
  element: ReviewConceptElement;
}) {
  return (
    <ConceptHover element={element}>
      <ElementBody element={element} />
    </ConceptHover>
  );
}

/** How a slot draws each element it holds: as the element draws anywhere. */
const drawElement = (element: ReviewConceptElement) => (
  <ReviewConceptElementView element={element} key={element.id} />
);
