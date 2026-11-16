import axe from "axe-core";
import { newItemId } from "../../config/proposal.js";
import { cleanPin, type ReviewPin } from "../../config/review.js";
import { criteriaOfAxeTags } from "../../config/wcag.js";
import { launch, openPage, preparePage } from "./screenshot.js";

/**
 * An accessibility scan of a review screen's live page: axe-core run in the
 * same browser, at the same width and laid out the same way as the capture,
 * so each failure becomes an Accessibility note pinned on the element that
 * fails, saying why and naming the WCAG criteria it breaks.
 *
 * WCAG A and AA rules only (2.0 to 2.2): every note is then something a
 * WCAG page explains how to fix. Each rule gets a note on its first few
 * failing elements, the rest counted in the note, so a page with fifty
 * low-contrast links reads as one finding with fifty places rather than
 * fifty notes over the picture.
 */

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
/** Notes per rule, and per scan. */
const PER_RULE = 3;
const MAX_NOTES = 30;
const MAX_BODY = 600;
/** A help URL's query string: axe adds its version and app name there. */
const QUERY_STRING = /\?.*$/;

interface Found {
  /** The element's box on the page, in CSS pixels from the top. */
  box: { height: number; left: number; top: number; width: number } | null;
  failure: string;
  help: string;
  helpUrl: string;
  id: string;
  impact: string;
  tags: string[];
  /** How many elements fail this rule in all. */
  total: number;
}

/**
 * Runs in the page, after axe is injected: each failing element's box in
 * page coordinates (the page is scrolled; the box is not). Plain JavaScript
 * in a string: a bundler's helpers (esbuild's `__name`) would otherwise be
 * sent along and are not defined in the page.
 */
const IN_PAGE = `async ({ perRule, tags }) => {
  const result = await window.axe.run(document, {
    resultTypes: ["violations"],
    runOnly: { type: "tag", values: tags },
  });
  return result.violations.flatMap((rule) =>
    rule.nodes.slice(0, perRule).map((node) => {
      const target = node.target[0];
      const el = typeof target === "string" ? document.querySelector(target) : null;
      const rect = el ? el.getBoundingClientRect() : null;
      return {
        box: rect && rect.width > 0 && rect.height > 0
          ? { height: rect.height, left: rect.left + window.scrollX, top: rect.top + window.scrollY, width: rect.width }
          : null,
        failure: node.failureSummary || "",
        help: rule.help,
        helpUrl: rule.helpUrl,
        id: rule.id,
        impact: rule.impact || "moderate",
        tags: rule.tags,
        total: rule.nodes.length,
      };
    })
  );
}`;

/** A line that already ends a sentence. */
const END_MARK = /[.!?)]$/;

const IMPACT_ORDER = ["critical", "serious", "moderate", "minor"];

/** axe's failure summary without its "Fix any of the following" headings. */
const reasonOf = (summary: string): string =>
  summary
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("Fix "))
    // Each line is one finding; as a sentence each, they read.
    .map((line) => (END_MARK.test(line) ? line : `${line}.`))
    .join(" ")
    .slice(0, MAX_BODY);

export interface ScanInput {
  /** The screen's picture height, CSS pixels: notes past it are dropped. */
  height: number;
  url: string;
  width: number;
}

export const scanAccessibility = async ({
  height,
  url,
  width,
}: ScanInput): Promise<ReviewPin[]> => {
  const browser = await launch();
  let found: Found[];
  try {
    const page = await openPage(browser, url, width);
    await preparePage(page);
    await page.addScriptTag({ content: axe.source });
    found = (await page.evaluate(
      `(${IN_PAGE})(${JSON.stringify({ perRule: PER_RULE, tags: TAGS })})`
    )) as Found[];
  } finally {
    await browser.close();
  }

  return found
    .filter((f) => f.box && f.box.top < height)
    .sort(
      (a, b) => IMPACT_ORDER.indexOf(a.impact) - IMPACT_ORDER.indexOf(b.impact)
    )
    .slice(0, MAX_NOTES)
    .map((f) => {
      const box = f.box as NonNullable<Found["box"]>;
      const others = f.total - 1;
      const more =
        others > 0
          ? ` ${others} other ${others === 1 ? "element fails" : "elements fail"} this check too.`
          : "";
      return cleanPin({
        body: `${reasonOf(f.failure)}${more}`,
        id: newItemId(),
        kind: "accessibility",
        title: `${f.help} (${f.impact})`,
        wcag: {
          criteria: criteriaOfAxeTags(f.tags),
          rule: f.id,
          ruleUrl: f.helpUrl.replace(QUERY_STRING, ""),
        },
        // The note sits on the element's top-left corner, inside its box.
        x: Math.min(1, (box.left + Math.min(12, box.width / 2)) / width),
        y: Math.min(1, (box.top + Math.min(12, box.height / 2)) / height),
      });
    });
};

declare global {
  interface Window {
    axe: typeof axe;
  }
}
