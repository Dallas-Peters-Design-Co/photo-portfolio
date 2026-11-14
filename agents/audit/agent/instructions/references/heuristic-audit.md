## Phase 3: Heuristic Audit

**Goal**: Walk the product through the 10 UX sections from [references/day-1-audit-checklist.html](references/day-1-audit-checklist.html) and produce classified findings for each. Combine observable heuristic evaluation (via `appUrl` or provided screenshots) with static code analysis patterns.

Apply the 21 Laws of UX from [references/laws-of-ux.md](references/laws-of-ux.md) throughout this phase. Use the Review Checklist to identify which laws are relevant to each section, and cite specific laws when documenting findings.

Run all 10 sections. For each section, produce a list of findings classified by severity using [references/severity-model.md](references/severity-model.md).

### Section 1: First Impressions & Visual Coherence

Walk the app at `appUrl` (or use screenshots if provided). Check:

- Does the product make a strong first impression? Is the purpose clear in the first 30 seconds?
- Is the visual language consistent? Check button styles, typography, color usage, spacing, and iconography across multiple screens.
- Does the brand come through clearly?
- Is there visual hierarchy on key screens — can you tell what's most important at a glance?
- Is the color system doing meaningful work (semantic usage) or are colors arbitrary?
- Does the typography scale feel intentional? Are heading levels distinct?

Code scan support: count unique hex colors and font-size values from Phase 1 to quantify inconsistency.

### Section 2: Navigation & Wayfinding

- Is the navigation structure predictable (follows conventions users know)?
- Do users always know where they are? Active states, breadcrumbs, page titles?
- Are navigation labels clear, plain-language, jargon-free?
- Is navigation depth appropriate (≤3 clicks to most things)?
- Does navigation work on mobile?
- Are there dead ends — screens with no clear path forward or back?

Code scan support: grep for `display: none` inside media queries (content being hidden vs adapting).

### Section 3: Cognitive Load & Complexity

- Are screens trying to do too much? Flag pages with overwhelming options or decisions.
- Is information chunked effectively — related items grouped, easy to scan?
- Are forms as simple as possible? Extra fields, illogical order?
- Does the UI use meaningful defaults to reduce decisions?
- Is the language plain and direct, or does it require interpretation?
- Are there progress indicators for multi-step processes?

### Section 4: Key Flows & Task Completion

Identify the top 2–3 core user tasks before evaluating this section. Walk each flow end to end.

- Is the entry point obvious?
- Are calls to action clear and appropriately sized?
- Does the flow match the user's mental model of the task?
- Are there unnecessary interruptions or confirmation steps?
- Are error states handled gracefully — clear, human, actionable?
- Does the product handle edge cases (empty states, long content, slow connections)?
- What is the peak moment and ending of each flow — are they positive?

### Section 5: Feedback & System Communication

- Does the product acknowledge user actions (buttons, form submissions)?
- Are loading states handled with visual feedback?
- Are success and error states distinct and immediately clear?
- Is undo/back behavior predictable?
- Are notifications and alerts used appropriately (not over-interrupting)?

Code scan support: grep for loading spinner patterns; grep for success/error toast/flash component usage.

### Section 6: Consistency & Standards

- Do similar elements behave the same way throughout?
- Does the product follow platform conventions (web, iOS, Android)?
- Is the component set stable, or are there one-off UI elements?
- Are interactive elements visually distinguishable from static ones?

Code scan support: Phase 1 hardcoded value counts per file indicate where visual drift is concentrated.

### Section 7: Accessibility

Static code analysis — grep the codebase for each of the following:

**Focus management**:
- `outline:\s*(none|0)` without corresponding `:focus-visible` replacement
- Missing skip-nav link (`[href="#main"]` or similar)
- Missing `<main>` landmark

**ARIA issues**:
- `role="menu"` on `<nav>` elements (incorrect — should be `navigation`)
- Buttons/toggles missing `aria-expanded`
- Icon-only buttons missing `aria-label`
- `<img` without `alt` attribute
- `<iframe` without `title` attribute
- Modals without `role="dialog"` and `aria-modal="true"`

**Semantic HTML**:
- `<a>` wrapping `<button>` (or vice versa)
- `<div>` with click handlers but no `role="button"` or `tabindex`
- `user-scalable=no` or `maximum-scale=1` in viewport meta

**Color contrast**:
- For each foreground/background pair identified in Phase 1, check WCAG AA ratio
- If Optics: use `mcp__optics__check_contrast`
- Flag anything below 4.5:1 (normal text) or 3:1 (large text)

**Form accessibility**:
- `<input>` without associated `<label>` or `aria-label`
- `<select>` placeholder options not `disabled`
- Missing `aria-required` on required fields
- No inline validation (submit-only)

Also note observable accessibility gaps from the product walkthrough: tap target sizes, motion, color-only status indicators.

### Section 8: Mobile & Responsive Behavior

- Does the layout adapt gracefully across breakpoints (mobile, tablet, desktop)?
- Are touch targets appropriately sized (minimum 44×44px)?
- Is any content hidden on mobile that's visible on desktop?
- Does the navigation pattern work on mobile? Is it thumb-friendly?
- Do forms work on mobile keyboards (correct input types, numeric for phone)?

Code scan support: grep for `@media` queries and `display: none` patterns within them.

### Section 9: Performance Perception

Observable only — not a technical perf audit:

- Does the product feel fast? Note any perceived slowness during loading, transitions, interactions.
- Are images and media obviously oversized?
- Are transitions and animations additive or distracting?

### Section 10: Strategic & Forward-Looking Notes

Step back from individual findings:

- What is the product's single strongest moment? What should be protected and built on?
- Where is the product most constrained by past decisions?
- What 1–2 changes would have the highest user impact with moderate effort?
- Is there a meaningful modernization opportunity (design system, accessibility overhaul, mobile-first)?
- What does "next" look like for this product?

### Phase 3 Output

Report summary to user:

```
Phase 3 Complete: Heuristic Audit
Section 1 – First Impressions:    N findings
Section 2 – Navigation:           N findings
Section 3 – Cognitive Load:       N findings
Section 4 – Key Flows:            N findings
Section 5 – Feedback:             N findings
Section 6 – Consistency:          N findings
Section 7 – Accessibility:        N findings (M WCAG violations)
Section 8 – Mobile:               N findings
Section 9 – Performance:          N findings
Section 10 – Strategic:           N findings
Total: N findings (C critical, H high, M medium, P patterns)
```

Classify each finding using [references/severity-model.md](references/severity-model.md).
