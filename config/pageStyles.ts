/**
 * A captured page's real styles: the colours, corner radii, borders and type
 * it uses, most used first, and what its buttons and pills look like. The
 * sign-in agent measures them in the live page as it takes each screenshot
 * (agents/audit/agent/tools/capture_screen.ts runs PAGE_STYLES_JS, its twin)
 * and stores them beside the picture; the audit's developer-rules pass reads
 * them, so the rules it gives are the app's own values, not guesses from a
 * screenshot.
 */

export interface StyleCount {
  count: number;
  value: string;
}

export interface StyledComponent {
  bg: string;
  border: string;
  color: string;
  font: string;
  height: number;
  kind: "button" | "pill";
  radius: string;
  text: string;
}

export interface PageStyles {
  backgrounds: StyleCount[];
  borders: StyleCount[];
  components: StyledComponent[];
  fonts: StyleCount[];
  radii: StyleCount[];
  text: StyleCount[];
}

/** Run in the page; returns the measurements as a JSON string. */
export const PAGE_STYLES_JS = `(() => {
  const count = (m, k) => m.set(k, (m.get(k) || 0) + 1);
  const text = new Map(), bgs = new Map(), radii = new Map(), fonts = new Map(), borders = new Map();
  const components = [];
  const seen = new Set();
  for (const el of Array.from(document.body.querySelectorAll("*")).slice(0, 5000)) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || cs.opacity === "0") continue;
    const own = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim());
    if (own) {
      count(text, cs.color);
      count(fonts, cs.fontFamily.split(",")[0].replace(/["']/g, "").trim() + " " + cs.fontWeight + " " + cs.fontSize);
    }
    if (cs.backgroundColor !== "rgba(0, 0, 0, 0)") count(bgs, cs.backgroundColor);
    if (cs.borderTopLeftRadius !== "0px") count(radii, cs.borderTopLeftRadius);
    if (cs.borderTopStyle !== "none" && cs.borderTopWidth !== "0px") count(borders, cs.borderTopWidth + " " + cs.borderTopColor);
    const tag = el.tagName.toLowerCase();
    const cls = String(el.getAttribute("class") || "").toLowerCase();
    const button = tag === "button" || el.getAttribute("role") === "button" || /\\b(btn|button)\\b/.test(cls);
    const pill = /(pill|badge|chip|tag|status)/.test(cls) || (own && r.height < 40 && parseFloat(cs.borderTopLeftRadius) >= r.height / 2 - 1);
    if ((button || pill) && components.length < 24) {
      const key = [button, cs.backgroundColor, cs.color, cs.borderTopLeftRadius].join("|");
      if (!seen.has(key)) {
        seen.add(key);
        components.push({
          bg: cs.backgroundColor,
          border: cs.borderTopWidth + " " + cs.borderTopStyle + " " + cs.borderTopColor,
          color: cs.color,
          font: cs.fontWeight + " " + cs.fontSize,
          height: Math.round(r.height),
          kind: button ? "button" : "pill",
          radius: cs.borderTopLeftRadius,
          text: (el.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 40),
        });
      }
    }
  }
  const top = (m, n) => Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, n).map(([value, c]) => ({ count: c, value }));
  return JSON.stringify({ backgrounds: top(bgs, 14), borders: top(borders, 8), components, fonts: top(fonts, 12), radii: top(radii, 10), text: top(text, 12) });
})()`;

const str = (v: unknown, max = 120): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

const counts = (v: unknown, max: number): StyleCount[] =>
  (Array.isArray(v) ? v : [])
    .slice(0, max)
    .map((c) => ({
      count:
        typeof c?.count === "number" && Number.isFinite(c.count)
          ? Math.max(0, Math.round(c.count))
          : 0,
      value: str(c?.value),
    }))
    .filter((c) => c.value);

/** Measurements from the agent or the database, bounded; null for none. */
export const cleanPageStyles = (value: unknown): PageStyles | null => {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const styles: PageStyles = {
    backgrounds: counts(raw.backgrounds, 14),
    borders: counts(raw.borders, 8),
    components: (Array.isArray(raw.components) ? raw.components : [])
      .slice(0, 24)
      .map((item: unknown) => (item ?? {}) as Record<string, unknown>)
      .map((c) => ({
        bg: str(c.bg),
        border: str(c.border),
        color: str(c.color),
        font: str(c.font),
        height:
          typeof c.height === "number" && Number.isFinite(c.height)
            ? Math.round(c.height)
            : 0,
        kind: c.kind === "button" ? ("button" as const) : ("pill" as const),
        radius: str(c.radius),
        text: str(c.text, 40),
      })),
    fonts: counts(raw.fonts, 12),
    radii: counts(raw.radii, 10),
    text: counts(raw.text, 12),
  };
  const empty =
    styles.text.length +
      styles.backgrounds.length +
      styles.components.length ===
    0;
  return empty ? null : styles;
};

const line = (label: string, list: StyleCount[]): string =>
  list.length === 0
    ? ""
    : `${label}: ${list.map((c) => `${c.value} (${c.count})`).join("; ")}`;

/** One screen's measurements as plain lines for a prompt. */
export const describeStyles = (title: string, s: PageStyles): string =>
  [
    `Screen "${title}" — measured in the live page (value (times used)):`,
    line("Text colours", s.text),
    line("Backgrounds", s.backgrounds),
    line("Borders", s.borders),
    line("Corner radii", s.radii),
    line("Type (family weight size)", s.fonts),
    ...s.components.map(
      (c) =>
        `${c.kind === "button" ? "Button" : "Pill"} "${c.text}": background ${c.bg}, text ${c.color}, radius ${c.radius}, border ${c.border}, ${c.font}, ${c.height}px tall`
    ),
  ]
    .filter(Boolean)
    .join("\n");
