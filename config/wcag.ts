/**
 * WCAG 2.2's Level A and AA success criteria: what an accessibility note on
 * a review names, and where the W3C explains how to meet it.
 *
 * Each links to its "Understanding" page on w3.org, which states the intent
 * and lists the techniques that satisfy it — the resolution, rather than
 * just the rule. 4.1.1 Parsing is left out: WCAG 2.2 removed it.
 */

export type WcagLevel = "A" | "AA";

export interface WcagCriterion {
  level: WcagLevel;
  name: string;
  /** "1.4.3" */
  number: string;
  /** The Understanding page's file name on w3.org. */
  slug: string;
}

const c = (
  number: string,
  name: string,
  level: WcagLevel,
  slug: string
): WcagCriterion => ({ level, name, number, slug });

export const WCAG_CRITERIA: WcagCriterion[] = [
  c("1.1.1", "Non-text Content", "A", "non-text-content"),
  c(
    "1.2.1",
    "Audio-only and Video-only (Prerecorded)",
    "A",
    "audio-only-and-video-only-prerecorded"
  ),
  c("1.2.2", "Captions (Prerecorded)", "A", "captions-prerecorded"),
  c(
    "1.2.3",
    "Audio Description or Media Alternative (Prerecorded)",
    "A",
    "audio-description-or-media-alternative-prerecorded"
  ),
  c("1.2.4", "Captions (Live)", "AA", "captions-live"),
  c(
    "1.2.5",
    "Audio Description (Prerecorded)",
    "AA",
    "audio-description-prerecorded"
  ),
  c("1.3.1", "Info and Relationships", "A", "info-and-relationships"),
  c("1.3.2", "Meaningful Sequence", "A", "meaningful-sequence"),
  c("1.3.3", "Sensory Characteristics", "A", "sensory-characteristics"),
  c("1.3.4", "Orientation", "AA", "orientation"),
  c("1.3.5", "Identify Input Purpose", "AA", "identify-input-purpose"),
  c("1.4.1", "Use of Color", "A", "use-of-color"),
  c("1.4.2", "Audio Control", "A", "audio-control"),
  c("1.4.3", "Contrast (Minimum)", "AA", "contrast-minimum"),
  c("1.4.4", "Resize Text", "AA", "resize-text"),
  c("1.4.5", "Images of Text", "AA", "images-of-text"),
  c("1.4.10", "Reflow", "AA", "reflow"),
  c("1.4.11", "Non-text Contrast", "AA", "non-text-contrast"),
  c("1.4.12", "Text Spacing", "AA", "text-spacing"),
  c("1.4.13", "Content on Hover or Focus", "AA", "content-on-hover-or-focus"),
  c("2.1.1", "Keyboard", "A", "keyboard"),
  c("2.1.2", "No Keyboard Trap", "A", "no-keyboard-trap"),
  c("2.1.4", "Character Key Shortcuts", "A", "character-key-shortcuts"),
  c("2.2.1", "Timing Adjustable", "A", "timing-adjustable"),
  c("2.2.2", "Pause, Stop, Hide", "A", "pause-stop-hide"),
  c(
    "2.3.1",
    "Three Flashes or Below Threshold",
    "A",
    "three-flashes-or-below-threshold"
  ),
  c("2.4.1", "Bypass Blocks", "A", "bypass-blocks"),
  c("2.4.2", "Page Titled", "A", "page-titled"),
  c("2.4.3", "Focus Order", "A", "focus-order"),
  c("2.4.4", "Link Purpose (In Context)", "A", "link-purpose-in-context"),
  c("2.4.5", "Multiple Ways", "AA", "multiple-ways"),
  c("2.4.6", "Headings and Labels", "AA", "headings-and-labels"),
  c("2.4.7", "Focus Visible", "AA", "focus-visible"),
  c(
    "2.4.11",
    "Focus Not Obscured (Minimum)",
    "AA",
    "focus-not-obscured-minimum"
  ),
  c("2.5.1", "Pointer Gestures", "A", "pointer-gestures"),
  c("2.5.2", "Pointer Cancellation", "A", "pointer-cancellation"),
  c("2.5.3", "Label in Name", "A", "label-in-name"),
  c("2.5.4", "Motion Actuation", "A", "motion-actuation"),
  c("2.5.7", "Dragging Movements", "AA", "dragging-movements"),
  c("2.5.8", "Target Size (Minimum)", "AA", "target-size-minimum"),
  c("3.1.1", "Language of Page", "A", "language-of-page"),
  c("3.1.2", "Language of Parts", "AA", "language-of-parts"),
  c("3.2.1", "On Focus", "A", "on-focus"),
  c("3.2.2", "On Input", "A", "on-input"),
  c("3.2.3", "Consistent Navigation", "AA", "consistent-navigation"),
  c("3.2.4", "Consistent Identification", "AA", "consistent-identification"),
  c("3.2.6", "Consistent Help", "A", "consistent-help"),
  c("3.3.1", "Error Identification", "A", "error-identification"),
  c("3.3.2", "Labels or Instructions", "A", "labels-or-instructions"),
  c("3.3.3", "Error Suggestion", "AA", "error-suggestion"),
  c(
    "3.3.4",
    "Error Prevention (Legal, Financial, Data)",
    "AA",
    "error-prevention-legal-financial-data"
  ),
  c("3.3.7", "Redundant Entry", "A", "redundant-entry"),
  c(
    "3.3.8",
    "Accessible Authentication (Minimum)",
    "AA",
    "accessible-authentication-minimum"
  ),
  c("4.1.2", "Name, Role, Value", "A", "name-role-value"),
  c("4.1.3", "Status Messages", "AA", "status-messages"),
];

const BY_NUMBER = new Map(WCAG_CRITERIA.map((item) => [item.number, item]));

export const wcagCriterion = (number: string): WcagCriterion | undefined =>
  BY_NUMBER.get(number);

/** Where the W3C explains a criterion and how to meet it. */
export const wcagUrl = (criterion: WcagCriterion): string =>
  `https://www.w3.org/WAI/WCAG22/Understanding/${criterion.slug}.html`;

/** "1.4.3 Contrast (Minimum) (AA)" */
export const wcagLabel = (criterion: WcagCriterion): string =>
  `${criterion.number} ${criterion.name} (${criterion.level})`;

const AXE_TAG = /^wcag(\d)(\d)(\d+)$/;

/**
 * The criteria an axe-core rule tests, from its tags: "wcag143" is 1.4.3.
 * Tags for whole levels ("wcag2aa") and for criteria this list does not
 * hold are dropped.
 */
export const criteriaOfAxeTags = (tags: readonly string[]): string[] =>
  tags
    .map((tag) => AXE_TAG.exec(tag))
    .filter((m): m is RegExpExecArray => m !== null)
    .map(([, a, b, rest]) => `${a}.${b}.${rest}`)
    .filter((number) => BY_NUMBER.has(number));
