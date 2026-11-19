/**
 * Accessibility scan for the docs' component pages.
 *
 * Each kit's components are loaded into real Chromium (Playwright) with the
 * kit's CSS and fonts, exactly as the docs draw them, and axe-core checks
 * each one against WCAG 2.2 A and AA and axe's best practices: contrast,
 * names, roles, target size, form labels and the rest.
 *
 * Page-level rules are off. A component scanned alone is not a page, so
 * "no main landmark" or "no level-one heading" would be true of every one
 * of them and say nothing about the component.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const TAGS = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22aa",
  "best-practice",
];

/** Rules about a whole page, not a component on it. */
const PAGE_RULES = [
  "bypass",
  "document-title",
  "html-has-lang",
  "landmark-one-main",
  "page-has-heading-one",
  "region",
];

const QUERY_STRING = /\?.*$/;

/** What axe found about one component, trimmed to what a page shows. */
const resultOf = (raw) => ({
  incomplete: raw.incomplete.map((rule) => ({ help: rule.help, id: rule.id })),
  passes: raw.passes.length,
  violations: raw.violations.map((rule) => ({
    help: rule.help,
    helpUrl: rule.helpUrl.replace(QUERY_STRING, ""),
    id: rule.id,
    impact: rule.impact,
    // Colour contrast says by how much; the rest say how many elements.
    nodes: rule.nodes.map((node) => {
      const data = node.any.find((check) => check.data?.contrastRatio)?.data;
      return data
        ? {
            background: data.bgColor,
            expected: data.expectedContrastRatio,
            foreground: data.fgColor,
            ratio: data.contrastRatio,
          }
        : {};
    }),
  })),
});

/**
 * Scans every component of every kit. Returns, per kit slug, per component
 * class, axe's result; and the axe version, for the pages to name.
 */
export const scanKits = async (kits, { css }) => {
  const { chromium } = await import("playwright");
  const axeSource = readFileSync(
    require.resolve("axe-core/axe.min.js"),
    "utf8"
  );
  const { version } = require("axe-core/package.json");
  const browser = await chromium.launch();
  const results = {};
  try {
    // One page per kit, so the kits scan side by side.
    await Promise.all(
      kits.map(async (kit) => {
        const page = await browser.newPage();
        const body = kit.components
          .map(
            ({ html, source, previewBackground }) =>
              `<section class="bk-preview bk-${kit.slug}" data-component="${source.className}"${previewBackground ? ` style="background:${previewBackground}"` : ""}>${html}</section>`
          )
          .join("\n");
        await page.setContent(
          `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${kit.name}</title><style>${css}</style></head><body>${body}</body></html>`,
          { waitUntil: "networkidle" }
        );
        await page.evaluate(() => document.fonts.ready);
        await page.addScriptTag({ content: axeSource });
        // axe refuses a second run while one is going, so the components
        // run one after another, chained inside the page.
        const raws = await page.evaluate(
          ({ classNames, disabled, tags }) =>
            classNames.reduce(
              (chain, className) =>
                chain.then((found) =>
                  window.axe
                    .run(
                      document.querySelector(`[data-component="${className}"]`),
                      {
                        resultTypes: ["violations", "incomplete"],
                        rules: Object.fromEntries(
                          disabled.map((id) => [id, { enabled: false }])
                        ),
                        runOnly: { type: "tag", values: tags },
                      }
                    )
                    .then((raw) => {
                      found[className] = raw;
                      return found;
                    })
                ),
              Promise.resolve({})
            ),
          {
            classNames: kit.components.map(({ source }) => source.className),
            disabled: PAGE_RULES,
            tags: TAGS,
          }
        );
        results[kit.slug] = Object.fromEntries(
          Object.entries(raws).map(([className, raw]) => [
            className,
            resultOf(raw),
          ])
        );
      })
    );
  } finally {
    await browser.close();
  }
  return { results, version };
};
