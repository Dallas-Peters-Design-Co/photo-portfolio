import { HugeiconsIcon } from "@hugeicons/react";
import type { CSSProperties } from "react";
import { shadowCss } from "../../../config/conceptShadow.js";
import { fontRefStack, parseFontRef } from "../../../config/fontRef.js";
import {
  type ConceptIconSvg,
  conceptIconName,
  iconSizeOf,
  type ReviewConceptElement,
  splitCardText,
} from "../../../config/reviewConcept.js";
import { findFont } from "../../../config/theme.js";
import { iconFrom, useIconMap } from "../../cms/useIconMap";

const ICON_SUFFIX = /Icon$/;

const familyCss = (element: ReviewConceptElement): string => {
  if (element.fontFamily === "app" && element.fontId) {
    return (
      findFont(element.fontId)?.stack ?? "var(--font-sans, Arial, sans-serif)"
    );
  }
  const ref = element.fontRef ? parseFontRef(element.fontRef) : null;
  if (element.fontFamily === "brand" && ref) {
    return fontRefStack(ref);
  }
  if (element.fontFamily === "serif") {
    return "Georgia, serif";
  }
  if (element.fontFamily === "mono") {
    return "ui-monospace, SFMono-Regular, Menlo, monospace";
  }
  return "var(--font-sans, Arial, sans-serif)";
};

/**
 * One icon from the site's Hugeicons set. The map loads in its own chunk, so
 * the public review page does not carry it; until it arrives the icon's box
 * holds its place.
 */
function ConceptIcon({
  color,
  name,
  size,
  svg,
}: {
  color?: string;
  name?: string;
  size: number;
  /** The saved drawing; without one (older concepts) the name is looked up. */
  svg?: ConceptIconSvg;
}) {
  const map = useIconMap(!svg && Boolean(name));
  const Icon = svg ?? iconFrom(map, conceptIconName(name));
  return Icon ? (
    <HugeiconsIcon
      aria-hidden
      color={color}
      icon={Icon}
      size={size}
      strokeWidth={2}
    />
  ) : (
    <span aria-hidden style={{ height: size, width: size }} />
  );
}

function CardPreview({
  element,
  style,
}: {
  element: ReviewConceptElement;
  style: CSSProperties;
}) {
  const card = splitCardText(element.text);
  return (
    <article
      className="review-concepts__card-preview"
      style={{
        ...style,
        borderColor: element.borderColor,
        boxShadow: shadowCss(element.shadow),
      }}
    >
      {element.iconName ? (
        <ConceptIcon
          color={element.iconColor}
          name={element.iconName}
          size={iconSizeOf(element)}
          svg={element.iconSvg}
        />
      ) : null}
      <strong>{card.title || "Card title"}</strong>
      {card.body ? (
        // Cards saved before bodySize existed keep one size for both.
        <p style={{ fontSize: element.bodySize ?? element.fontSize }}>
          {card.body}
        </p>
      ) : null}
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

export function ReviewConceptElementView({
  element,
}: {
  element: ReviewConceptElement;
}) {
  const style: CSSProperties = {
    background: element.background,
    border: ["input", "textarea", "select"].includes(element.kind)
      ? "1px solid color-mix(in srgb, currentColor 25%, transparent)"
      : undefined,
    borderRadius: element.radius,
    boxSizing: "border-box",
    color: element.color,
    fontFamily: familyCss(element),
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
      return (
        <button style={style} type="button">
          {text}
        </button>
      );
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
      return (
        <select aria-label={text} style={style} value="">
          <option value="">{text}</option>
          {(element.options ?? []).map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      );
    case "checkbox":
      return (
        <label className="review-concepts__checkbox-preview">
          <input checked={element.checked ?? false} readOnly type="checkbox" />
          {text}
        </label>
      );
    case "card":
      return <CardPreview element={element} style={style} />;
    case "label":
      return <span style={style}>{text}</span>;
    case "badge":
      return <span style={style}>{text}</span>;
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
      return (
        <nav
          aria-label="Preview tabs"
          className="review-concepts__tabs-preview"
          style={style}
        >
          {(element.options ?? [text]).map((option) => (
            <span
              aria-current={option === text ? "page" : undefined}
              key={option}
            >
              {option}
            </span>
          ))}
        </nav>
      );
    case "table":
      return (
        <table className="review-concepts__table-preview" style={style}>
          <thead>
            <tr>
              {(element.options ?? [text]).map((option) => (
                <th key={option}>{option}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {(element.options ?? [text]).map((option) => (
                <td key={option}>Example</td>
              ))}
            </tr>
          </tbody>
        </table>
      );
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
      return (
        <ul
          aria-label="Dropdown menu preview"
          className="review-concepts__menu-preview"
          style={style}
        >
          {(element.options ?? [text]).map((option) => (
            <li key={option}>{option}</li>
          ))}
        </ul>
      );
    case "toast":
      return (
        <div
          aria-label="Toast preview"
          className="review-concepts__toast-preview"
          role="status"
          style={style}
        >
          {text}
        </div>
      );
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
