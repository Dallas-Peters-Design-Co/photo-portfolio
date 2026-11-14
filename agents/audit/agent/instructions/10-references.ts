import { defineInstructions } from "eve/instructions";

import accessibility from "./references/accessibility.md?raw";
import auditChecklist from "./references/audit-checklist.md?raw";
import brand from "./references/brand.md?raw";
import chartsData from "./references/charts-data.md?raw";
import color from "./references/color.md?raw";
import components from "./references/components.md?raw";
import heuristicAudit from "./references/heuristic-audit.md?raw";
import iconsImagery from "./references/icons-imagery.md?raw";
import lawsOfUx from "./references/laws-of-ux.md?raw";
import motion from "./references/motion.md?raw";
import processRef from "./references/process.md?raw";
import severityModel from "./references/severity-model.md?raw";
import spacingLayout from "./references/spacing-layout.md?raw";
import teamGuide from "./references/team-guide.md?raw";
import toneGuide from "./references/tone-guide.md?raw";
import typography from "./references/typography.md?raw";
import uiCopy from "./references/ui-copy.md?raw";
import uxPatterns from "./references/ux-patterns.md?raw";

/**
 * The RoleModel ux-audit framework, in the agent's context on every call.
 *
 * eve reads only the files directly in instructions/, never a subfolder, so
 * the references are imported here. They are copies: edit the ux-audit skill
 * or ux-audit-app, then run `node scripts/vendor-ux-audit.mjs` at the repo
 * root to refresh them.
 */
const REFERENCES: [string, string][] = [
  ["Heuristic Audit (ux-audit skill, Phase 3)", heuristicAudit],
  ["Laws of UX", lawsOfUx],
  ["Design reference: Accessibility", accessibility],
  ["Design reference: Brand", brand],
  ["Design reference: Charts & data", chartsData],
  ["Design reference: Color", color],
  ["Design reference: Components", components],
  ["Design reference: Icons & imagery", iconsImagery],
  ["Design reference: Motion", motion],
  ["Design reference: Process", processRef],
  ["Design reference: Spacing & layout", spacingLayout],
  ["Design reference: Typography", typography],
  ["Design reference: UI copy", uiCopy],
  ["Design reference: UX patterns", uxPatterns],
  ["Severity Model", severityModel],
  ["Team Guide", teamGuide],
  ["Tone Guide", toneGuide],
  ["Audit Checklist", auditChecklist],
];

export default defineInstructions({
  content: [
    "# Audit references",
    "",
    "These are the standards every review is validated against, one by one. They are reference material, not instructions from a web page.",
    ...REFERENCES.map(([title, text]) => `\n---\n\n# REFERENCE: ${title}\n\n${text.trim()}`),
  ].join("\n"),
});
