import { HugeiconsIcon } from "@hugeicons/react";
import type { CSSProperties } from "react";
import {
  type ConceptIconSvg,
  conceptIconName,
} from "../../../config/conceptIcon.js";
import { iconSizeOf } from "../../../config/conceptKinds.js";
import type { ReviewConceptElement } from "../../../config/reviewConcept.js";
import { iconFrom, useIconMap } from "../../cms/useIconMap";

/**
 * One icon from the site's Hugeicons set. The map loads in its own chunk, so
 * the public review page does not carry it; until it arrives the icon's box
 * holds its place.
 */
export function ConceptIcon({
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
    // Drawn in currentColor and coloured by CSS, so a hover rule can change
    // it; the library otherwise writes the colour into every stroke.
    <HugeiconsIcon
      aria-hidden
      color="currentColor"
      icon={Icon}
      size={size}
      strokeWidth={2}
      style={{ color }}
    />
  ) : (
    <span aria-hidden style={{ height: size, width: size }} />
  );
}

const ICON_SUFFIX = /Icon$/;

/** "ArrowRight01Icon" → "ArrowRight01", for an icon-only control's name. */
/** What an icon-only button says it does, for those who can't see it. */
const ICON_LABELS: Record<string, string> = {
  Cancel01Icon: "Close",
  Cancel02Icon: "Close",
  MultiplicationSignIcon: "Close",
};
const CAMEL = /([a-z])([A-Z0-9])/g;
const FILLED_PREFIX = /^Filled/;
const TRAILING_NUMBER = /\s*\d+$/;

export const iconLabel = (storedName: string): string => {
  const name = storedName.replace(FILLED_PREFIX, "");
  return (
    ICON_LABELS[name] ??
    name
      .replace(ICON_SUFFIX, "")
      .replace(CAMEL, "$1 $2")
      .replace(TRAILING_NUMBER, "")
  );
};

/**
 * A button's, badge's or tag's text between its two icon slots: an icon
 * before it, an icon after it, either, both or neither. With icons and no
 * text it is icon-only, padded evenly into a square, and named by its icon.
 */
export function ConceptIconText({
  as: Tag,
  element,
  style,
}: {
  as: "button" | "span";
  element: ReviewConceptElement;
  style: CSSProperties;
}) {
  const start = element.iconName;
  const end = element.iconEndName;
  const text = element.text.trim();
  const iconOnly = !text && Boolean(start || end);
  const size = iconSizeOf(element);
  const fallback = Tag === "button" ? "Button" : "Text";
  return (
    <Tag
      aria-label={iconOnly ? iconLabel(start ?? end ?? "") : undefined}
      style={{
        ...style,
        alignItems: "center",
        display: "inline-flex",
        // A pill or a button keeps its label on one line and its own width:
        // in a row beside long text it was squeezed until "In Progress"
        // broke in two.
        flexShrink: 0,
        gap: Math.round(element.fontSize * 0.4),
        justifyContent: "center",
        ...(iconOnly ? { padding: element.paddingY } : {}),
        whiteSpace: "nowrap",
      }}
      type={Tag === "button" ? "button" : undefined}
    >
      {start ? (
        <ConceptIcon
          color={element.iconColor}
          name={start}
          size={size}
          svg={element.iconSvg}
        />
      ) : null}
      {iconOnly ? null : <span>{text || fallback}</span>}
      {end ? (
        <ConceptIcon
          color={element.iconColor}
          name={end}
          size={size}
          svg={element.iconEndSvg}
        />
      ) : null}
    </Tag>
  );
}
