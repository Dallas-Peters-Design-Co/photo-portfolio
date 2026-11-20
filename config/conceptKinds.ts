import { cleanIconSvg, conceptIconName } from "./conceptIcon.js";
import { cleanShadow } from "./conceptShadow.js";
import { bounded, isHex, str } from "./conceptValues.js";
import type {
  ReviewConceptElement,
  ReviewConceptElementKind,
} from "./reviewConcept.js";

/**
 * What only some kinds of element carry — an icon, a box's border and
 * shadow, a checkbox's box, a toast's action, a card's body size — and the
 * rules that keep each.
 */

/** Kinds that may carry an icon beside their text; an icon element always has one. */
const OPTIONAL_ICON_KINDS = new Set<ReviewConceptElementKind>([
  "accordion",
  "badge",
  "button",
  "card",
  "input",
  "tag",
]);

export const takesIcon = (kind: ReviewConceptElementKind): boolean =>
  OPTIONAL_ICON_KINDS.has(kind);

/** Kinds with an icon slot on each side of their text: before and after. */
const END_ICON_KINDS = new Set<ReviewConceptElementKind>([
  "badge",
  "button",
  "tag",
]);

export const takesEndIcon = (kind: ReviewConceptElementKind): boolean =>
  END_ICON_KINDS.has(kind);

/** A card's icon leads at 1.5× its title; an input's sits at text size. */
export const iconSizeOf = (element: ReviewConceptElement): number =>
  element.iconSize ??
  (element.kind === "card"
    ? Math.round(element.fontSize * 1.5)
    : element.fontSize);

export const cleanIcon = (
  kind: ReviewConceptElementKind,
  raw: Partial<ReviewConceptElement>
): Pick<
  ReviewConceptElement,
  | "summaryIconName"
  | "summaryIconSvg"
  | "iconColor"
  | "iconEndName"
  | "iconEndSvg"
  | "iconName"
  | "iconSize"
  | "iconSvg"
> => {
  // An optional icon with an unknown name is dropped, not made a star.
  const named =
    conceptIconName(raw.iconName) ?? (kind === "icon" ? "StarIcon" : null);
  const iconName = named && (kind === "icon" || takesIcon(kind)) ? named : null;
  const iconEndName = takesEndIcon(kind)
    ? conceptIconName(raw.iconEndName)
    : null;
  const summaryIconName =
    kind === "accordion" ? conceptIconName(raw.summaryIconName) : null;
  if (!(iconName || iconEndName || summaryIconName)) {
    return {};
  }
  const iconSvg = iconName ? cleanIconSvg(raw.iconSvg) : undefined;
  const iconEndSvg = iconEndName ? cleanIconSvg(raw.iconEndSvg) : undefined;
  return {
    ...(summaryIconName
      ? { summaryIconName, summaryIconSvg: cleanIconSvg(raw.summaryIconSvg) }
      : {}),
    ...(iconName ? { iconName } : {}),
    ...(iconSvg ? { iconSvg } : {}),
    ...(iconEndName ? { iconEndName } : {}),
    ...(iconEndSvg ? { iconEndSvg } : {}),
    ...(takesIcon(kind) && isHex(raw.iconColor)
      ? { iconColor: raw.iconColor }
      : {}),
    ...(takesIcon(kind) && typeof raw.iconSize === "number"
      ? { iconSize: bounded(raw.iconSize, 8, 96, 24) }
      : {}),
  };
};

/**
 * Kinds drawn as a box, with an editable border (colour or none, width) and
 * shadow: the controls, the surfaces and the pills.
 */
const BOX_KINDS = new Set<ReviewConceptElementKind>([
  "accordion",
  "group",
  "tooltip",
  "badge",
  "button",
  "buttonGroup",
  "card",
  "input",
  "navbar",
  "panel",
  "select",
  "table",
  "tag",
  "textarea",
  "upload",
]);

export const takesBox = (kind: ReviewConceptElementKind): boolean =>
  BOX_KINDS.has(kind);

export const cleanBox = (
  kind: ReviewConceptElementKind,
  raw: Partial<ReviewConceptElement>
): Pick<
  ReviewConceptElement,
  "borderColor" | "borderWidth" | "shadow" | "fullHeight"
> => {
  if (!takesBox(kind)) {
    return {};
  }
  const shadow = cleanShadow(raw.shadow);
  return {
    ...((kind === "card" || kind === "panel") &&
    typeof raw.fullHeight === "boolean"
      ? { fullHeight: raw.fullHeight }
      : {}),
    // "transparent" is the editor's None: kept, so it is not a fallback.
    ...(isHex(raw.borderColor) || raw.borderColor === "transparent"
      ? { borderColor: raw.borderColor }
      : {}),
    ...(typeof raw.borderWidth === "number"
      ? { borderWidth: bounded(raw.borderWidth, 0, 8, 1) }
      : {}),
    ...(shadow ? { shadow } : {}),
  };
};

export const cleanCheckbox = (
  raw: Partial<ReviewConceptElement>
): Pick<ReviewConceptElement, "accentColor" | "checkSize"> => ({
  ...(isHex(raw.accentColor) ? { accentColor: raw.accentColor } : {}),
  ...(typeof raw.checkSize === "number"
    ? { checkSize: bounded(raw.checkSize, 10, 40, 18) }
    : {}),
});

const MAX_TOAST_ACTION = 40;

export const cleanToast = (
  raw: Partial<ReviewConceptElement>
): Pick<
  ReviewConceptElement,
  "accentColor" | "toastAction" | "toastClose"
> => ({
  ...(isHex(raw.accentColor) ? { accentColor: raw.accentColor } : {}),
  ...(typeof raw.toastAction === "string"
    ? { toastAction: str(raw.toastAction, MAX_TOAST_ACTION) }
    : {}),
  ...(typeof raw.toastClose === "boolean"
    ? { toastClose: raw.toastClose }
    : {}),
});

const TITLE_WEIGHTS = [400, 500, 600, 700] as const;

export const cleanCard = (
  raw: Partial<ReviewConceptElement>
): Pick<ReviewConceptElement, "bodySize" | "titleWeight"> => ({
  ...(typeof raw.bodySize === "number"
    ? { bodySize: bounded(raw.bodySize, 10, 72, 14) }
    : {}),
  ...(TITLE_WEIGHTS.includes(raw.titleWeight as 400)
    ? { titleWeight: raw.titleWeight }
    : {}),
});

/** A progress bar's limits: its value in percent and its bar's height in px. */
export const PROGRESS_LIMITS = {
  barHeight: [2, 24],
  progress: [0, 100],
} as const;

export const cleanProgress = (
  raw: Partial<ReviewConceptElement>
): Pick<
  ReviewConceptElement,
  "accentColor" | "barHeight" | "progress" | "showValue"
> => ({
  ...(isHex(raw.accentColor) ? { accentColor: raw.accentColor } : {}),
  barHeight: bounded(raw.barHeight, ...PROGRESS_LIMITS.barHeight, 8),
  progress: bounded(raw.progress, ...PROGRESS_LIMITS.progress, 60),
  ...(typeof raw.showValue === "boolean" ? { showValue: raw.showValue } : {}),
});

const AVATAR_URL = /^https?:\/\//i;
const HTTPS = /^https:\/\//i;
export const cleanAvatar = (raw: Partial<ReviewConceptElement>) => {
  const url = str(raw.avatarUrl, 2048).trim();
  return {
    avatarInitials: str(raw.avatarInitials, 8),
    ...(AVATAR_URL.test(url) && URL.canParse(url) ? { avatarUrl: url } : {}),
  };
};

/** A logo's picture and height; a picture not on https is dropped. */
export const cleanLogo = (
  raw: Partial<ReviewConceptElement>
): Pick<ReviewConceptElement, "logoHeight" | "logoUrl"> => ({
  logoHeight: bounded(raw.logoHeight, 12, 160, 32),
  ...(typeof raw.logoUrl === "string" && HTTPS.test(raw.logoUrl)
    ? { logoUrl: raw.logoUrl.slice(0, 2048) }
    : {}),
});

export const cleanStateName = (value: unknown) =>
  typeof value === "string" ? { stateName: value.slice(0, 64) } : {};
