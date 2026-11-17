/**
 * What the audit is told when its review has a brief (config/reviewBrief.ts):
 * the client's own words on scope, what must stay, and what they want back.
 *
 * The review-wide call holds the whole audit to the brief and accounts for
 * each item it asks for; each screen's call covers what its screen shows of
 * it. Without a brief, nothing here is added.
 */

const COVERAGE_SHAPE = `"coverage": [
    {
      "item": "A few words naming one thing the brief asks the review to cover",
      "status": "covered" | "partial" | "missing",
      "where": "The screens (by title) and the findings or recommendations that cover it; for partial or missing, what screen or check is still needed."
    }
  ]`;

/** Added to the review-wide call's instructions. */
export const siteBriefRules = (brief: string): string =>
  brief
    ? `

The client's brief for this review is given after the screens. It sets the scope. Hold the whole audit to it:
- Cover every area, flow, topic and question it names. Where it asks for a deliverable in a particular shape (for example must-fix versus recommended), shape "recommendations" that way and start each title with its group, e.g. "Must fix: …" or "Recommended: …".
- Respect what it says must stay, such as a logo or wordmark that is kept: never recommend changing it, and where a finding touches it, say it stays.
- Where it asks for rules a developer can apply (colours, what each component or pill means, corner radius, spacing, type), give them as concrete recommendations naming the values seen on the screens.

Also add this key to the JSON object, with one entry per thing the brief asks the review to cover, in the brief's order:
  ${COVERAGE_SHAPE}
Use "missing" when no screen shows that area or topic. Never claim coverage the screens do not show.`
    : "";

/** Added to each screen's call. */
export const screenBriefRules = (brief: string): string =>
  brief
    ? `

The client's brief for this review is given after the screens. Where this screen shows something it asks about (an area or flow, a topic such as colour-blind accessibility, a rule a developer needs), cover it in the findings. Never recommend changing anything the brief says must stay.`
    : "";

/** The brief itself, placed after the tiles and before the manifest. */
export const briefText = (brief: string): string =>
  brief ? `Client brief, as written:\n<brief>\n${brief}\n</brief>\n\n` : "";
