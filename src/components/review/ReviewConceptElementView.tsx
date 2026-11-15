import {
  ArrowRight,
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  Heart,
  Home,
  type LucideIcon,
  Mail,
  Menu,
  Plus,
  Search,
  Settings,
  ShoppingBag,
  Star,
  User,
  X,
} from "lucide-react";
import type { CSSProperties } from "react";
import { fontRefStack, parseFontRef } from "../../../config/fontRef.js";
import {
  CARD_SHADOWS,
  type ReviewConceptElement,
  type ReviewConceptIcon,
  splitCardText,
} from "../../../config/reviewConcept.js";
import { findFont } from "../../../config/theme.js";

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

const CONCEPT_ICONS: Record<ReviewConceptIcon, LucideIcon> = {
  "arrow-right": ArrowRight,
  bell: Bell,
  check: Check,
  "chevron-down": ChevronDown,
  "chevron-right": ChevronRight,
  heart: Heart,
  home: Home,
  mail: Mail,
  menu: Menu,
  plus: Plus,
  search: Search,
  settings: Settings,
  "shopping-bag": ShoppingBag,
  star: Star,
  user: User,
  x: X,
};

function CardPreview({
  element,
  style,
}: {
  element: ReviewConceptElement;
  style: CSSProperties;
}) {
  const card = splitCardText(element.text);
  const CardIcon = element.iconName ? CONCEPT_ICONS[element.iconName] : null;
  return (
    <article
      className="review-concepts__card-preview"
      style={{
        ...style,
        borderColor: element.borderColor,
        boxShadow: CARD_SHADOWS[element.shadow ?? "soft"],
      }}
    >
      {CardIcon ? (
        <CardIcon
          aria-hidden
          size={Math.round(element.fontSize * 1.5)}
          strokeWidth={2}
        />
      ) : null}
      <strong>{card.title || "Card title"}</strong>
      {card.body ? <p>{card.body}</p> : null}
    </article>
  );
}

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
      const iconName = element.iconName ?? "star";
      const Icon = CONCEPT_ICONS[iconName];
      return (
        <span
          aria-label={`${iconName} icon`}
          role="img"
          style={{
            ...style,
            alignItems: "center",
            display: "inline-flex",
            justifyContent: "center",
            lineHeight: 0,
          }}
        >
          <Icon aria-hidden size={element.fontSize} strokeWidth={2} />
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
      return (
        <input
          aria-label={element.placeholder || text}
          placeholder={element.placeholder}
          readOnly
          style={style}
          type={element.inputType ?? "text"}
          value={element.text}
        />
      );
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
