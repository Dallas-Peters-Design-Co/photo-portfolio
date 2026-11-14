import type { ReviewScreen } from "../../../config/review.js";
import { sanitizeUxAudit, type UxAudit } from "../../../config/reviewAudit.js";
import { claudeToken } from "../claudeAuth.js";
import { parsePublicHttpUrl } from "../httpUrl.js";
import { fetchMarkup, type PageMarkup } from "./page.js";
import {
  isStoredImage,
  type Tile,
  type TileSource,
  tileScreens,
  toScreenPoint,
} from "./tiles.js";
import { AUDIT_CHECKLIST } from "./vendor/audit-checklist.js";
import { DESIGN_REFERENCES } from "./vendor/design-references.js";
import { HEURISTIC_AUDIT } from "./vendor/heuristic-audit.js";
import { LAWS_OF_UX } from "./vendor/laws-of-ux.js";
import { SEVERITY_MODEL } from "./vendor/severity-model.js";
import { TEAM_GUIDE } from "./vendor/team-guide.js";
import { TONE_GUIDE } from "./vendor/tone-guide.js";

/**
 * Runs a UX audit across a review's captured screens through Claude.
 *
 * Each screen is cut into readable tiles (T1, T2…) and paired with the
 * cleaned HTML from its source URL when reachable. The model places each
 * visual finding on the tile where it appears; `placeOnScreens` translates
 * tile coordinates back to the full screen before `sanitizeUxAudit` bounds
 * the result.
 */

const MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";
/** An audit runs once per review and is read by a client: worth the best model. */
const AUDIT_MODEL = "claude-opus-5-5";
/**
 * Under the route's 300s ceiling with room for the tiling before it. Reading
 * two dozen tiles and writing a full audit takes Opus one to three minutes.
 */
const REQUEST_TIMEOUT_MS = 240_000;
/** A full audit is several thousand tokens of JSON; cut short, it will not parse. */
const MAX_OUTPUT_TOKENS = 16_000;
/** One screen's findings are a few thousand tokens. */
const SCREEN_OUTPUT_TOKENS = 10_000;
const MAX_MARKUP_URLS = 4;
const JSON_FENCE = /```(?:json)?\s*([\s\S]*?)```/i;

const apiKey = (): string | null =>
  (process.env.ANTHROPIC_API_KEY ?? "").trim() || null;

export const isClaudeAuditConfigured = async (): Promise<boolean> =>
  Boolean(apiKey()) || (await claudeToken()) !== null;

const authHeaders = async (): Promise<Record<string, string>> => {
  const token = await claudeToken();
  if (token) {
    return { authorization: `Bearer ${token}` };
  }
  const key = apiKey();
  if (key) {
    return { "x-api-key": key };
  }
  throw new Error("Claude is not configured for this deployment");
};

/**
 * The ux-audit skill's method and references, verbatim (vendor/, regenerated
 * by scripts/vendor-ux-audit.mjs). Identical on every call, so cached once.
 */
const REFERENCE = `You are a senior UX/UI auditor at RoleModel Software preparing a client-facing review ("audience": "client"), following the RoleModel ux-audit skill below. Its Phase 3 Heuristic Audit is your method; the Laws of UX are the authoritative source for every principle; the Design References are the house standards for typography, colour, spacing, components, copy and the rest; the Severity Model classifies findings; the Team Guide and Tone Guide set how the client reads it ("Then / Now / Next").

You work from screenshots and page markup only. Skip the skill's codebase-scan steps ("Code scan support"), and never claim a file, line, contrast ratio or count you cannot see. Ground every statement in what is visibly shown on the screenshot tiles or present in the HTML markup.

---
${HEURISTIC_AUDIT}
---
${LAWS_OF_UX}
---
${DESIGN_REFERENCES}
---
${SEVERITY_MODEL}
---
${TEAM_GUIDE}
---
${TONE_GUIDE}
---
${AUDIT_CHECKLIST}`;

const PIN_RULES = `- When a finding is visible on a screenshot tile, set "tile" to that tile's label ("T1", "T2", etc.) and set "x" and "y" to the pin's position within that tile as fractions from 0.0 to 1.0 (0,0 is top-left of that tile; 1,1 is bottom-right of that tile). Place the pin directly on the element being discussed.
- When a finding is structural rather than a single spot on a tile, set "tile" to null.`;

const FINDING_SHAPE = `{
      "tile": "T1",
      "x": 0.45,
      "y": 0.32,
      "kind": "issue" | "recommendation" | "suggestion" | "praise",
      "area": "The Phase 3 section it belongs to: First Impressions | Navigation | Cognitive Load | Key Flows | Feedback | Consistency | Accessibility | Mobile | Performance | Strategic",
      "headline": "Short, constructive title",
      "detail": "2-4 sentences: what was observed, what it means for visitors, and what to do. End with the law it rests on in parentheses, plain name first, e.g. (Fewer choices, faster decisions — Hick's Law)."
    }`;

/** The whole-review call: the narrative, and every law assessed by name. */
const SITE_INSTRUCTIONS = `Your task in this call: the review-wide assessment. Separate calls pin findings on each screen, so do not list per-screen details here.

Laws of UX — an exception to the Tone Guide's naming rule, at the client's request: assess EVERY one of the 21 laws in the Laws of UX reference above, one entry each, in the reference's order. Name each entry "Plain-language name (Academic name)", e.g. "Fewer choices, faster decisions (Hick's Law)". For each, judge the screens against the law's review checklist and say concretely where it holds or breaks, naming the screens and elements. Use "pass" only when the screens clearly honour it, "attention" when it visibly costs visitors, otherwise "opportunity".

Reply with a single JSON object and nothing else (no markdown fences, no commentary):
{
  "execSummary": "3-5 sentence executive summary for the client.",
  "nowFraming": "1-2 sentences framing what has evolved and why these improvements matter now.",
  "strengths": [
    { "title": "Short title", "detail": "2-3 sentences acknowledging what works well and why." }
  ],
  "principles": [
    {
      "name": "Plain-language name (Academic name)",
      "status": "pass" | "opportunity" | "attention",
      "detail": "2-4 sentences of evidence from the screens and what it means for visitors."
    }
  ],
  "recommendations": [
    { "title": "Actionable next step", "detail": "2-3 sentences on what to do and what the client gains." }
  ],
  "findings": [
    ${FINDING_SHAPE}
  ]
}

Aim for 5-8 strengths, one principles entry per law in the reference, 6-10 recommendations ordered by impact, and only site-wide findings with "tile": null (cross-page consistency, navigation structure, performance, content strategy).`;

/** One screen's call: a thorough pass over that screen alone. */
const screenInstructions = (title: string): string =>
  `Your task in this call: a thorough Phase 3 Heuristic Audit of ONE screen, "${title}". Walk all ten sections against this screen, top to bottom. In each section use the Laws of UX review checklists and the Design References to find what a careful senior reviewer would raise, and classify each finding with the Severity Model. Include what works as well as what does not. Laws of UX may be named in findings, at the client's request — an exception to the Tone Guide's naming rule.

${PIN_RULES}

Reply with a single JSON object and nothing else (no markdown fences, no commentary):
{
  "findings": [
    ${FINDING_SHAPE}
  ]
}

Aim for 10-18 findings for this screen, spread over the whole of it rather than only the top, touching every section that applies, with at least two "praise" findings where they are earned. Use "issue" for Critical and High severity, "recommendation" for Medium, "suggestion" for Patterns and polish. Do not repeat the same point twice.`;

const clamp01 = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v)
    ? Math.min(1, Math.max(0, v))
    : 0.5;

/**
 * Translates tile-relative `{ tile: "T1", x, y }` findings from the model
 * into screen-relative `{ screenId, x, y }` findings for `sanitizeUxAudit`.
 */
export const placeOnScreens = (
  raw: unknown,
  tiles: Pick<Tile, "bottom" | "label" | "screenId" | "top">[],
  screenIds: string[]
): UxAudit => {
  const obj =
    typeof raw === "object" && raw !== null
      ? (raw as Record<string, unknown>)
      : {};
  const byLabel = new Map(
    tiles.map((t) => [t.label.trim().toUpperCase(), t] as const)
  );
  const findings = Array.isArray(obj.findings)
    ? obj.findings.map((item) => {
        if (typeof item !== "object" || item === null) {
          return item;
        }
        const f = item as Record<string, unknown>;
        const label =
          typeof f.tile === "string" ? f.tile.trim().toUpperCase() : "";
        const tile = label ? byLabel.get(label) : undefined;
        if (tile) {
          const pt = toScreenPoint(tile, clamp01(f.x), clamp01(f.y));
          return { ...f, screenId: tile.screenId, x: pt.x, y: pt.y };
        }
        return f;
      })
    : [];
  return sanitizeUxAudit({ ...obj, findings }, screenIds);
};

/** Parses the JSON object from the model's reply text. */
export const parseAuditReply = (
  reply: string,
  tiles: Pick<Tile, "bottom" | "label" | "screenId" | "top">[],
  screenIds: string[]
): UxAudit => {
  const trimmed = reply.trim();
  const fenced = JSON_FENCE.exec(trimmed)?.[1]?.trim() ?? trimmed;
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  const slice =
    start >= 0 && end > start ? fenced.slice(start, end + 1) : fenced;
  const parsed: unknown = JSON.parse(slice);
  return placeOnScreens(parsed, tiles, screenIds);
};

const uniqueUrls = (screens: ReviewScreen[]): string[] => {
  const seen = new Set<string>();
  for (const s of screens) {
    const clean = s.sourceUrl ? parsePublicHttpUrl(s.sourceUrl) : null;
    if (clean && !seen.has(clean) && seen.size < MAX_MARKUP_URLS) {
      seen.add(clean);
    }
  }
  return [...seen];
};

const formatMarkups = (
  pages: { markup: PageMarkup; url: string }[]
): string => {
  if (pages.length === 0) {
    return "No live HTML markup was reachable; rely on the screenshot tiles.";
  }
  return pages
    .map(({ url, markup }) => {
      const note = markup.isShell
        ? " (client-rendered app shell; rely primarily on the screenshots)"
        : "";
      return `### HTML for ${url}${note}\n${markup.html}`;
    })
    .join("\n\n");
};

export const sourcesFromScreens = (screens: ReviewScreen[]): TileSource[] =>
  screens.flatMap((s, index) =>
    s.image && isStoredImage(s.image.url)
      ? [
          {
            id: s.id,
            title: s.title.trim() || `Screen ${index + 1}`,
            url: s.image.url,
            viewport: s.viewport,
          },
        ]
      : []
  );

export const runUxAudit = async ({
  screens,
  title,
}: {
  screens: ReviewScreen[];
  title?: string;
}): Promise<UxAudit> => {
  const sources = sourcesFromScreens(screens);
  if (sources.length === 0) {
    throw new Error(
      "Capture or upload at least one screen before running an audit."
    );
  }
  const urls = uniqueUrls(screens);
  const [tiles, fetchedPages] = await Promise.all([
    tileScreens(sources),
    Promise.all(
      urls.map(async (url) => {
        const markup = await fetchMarkup(url);
        return markup ? { markup, url } : null;
      })
    ),
  ]);
  const pages = fetchedPages.filter(
    (p): p is { markup: PageMarkup; url: string } => p !== null
  );

  const screenIds = sources.map((s) => s.id);
  const pageFor = (url: string) =>
    pages.filter((p) => p.url === parsePublicHttpUrl(url));
  const sourceUrlOf = new Map(screens.map((s) => [s.id, s.sourceUrl]));

  // Every call starts together: the whole-review call and one per screen.
  // A failed screen is reported in the summary rather than sinking the rest.
  const [site, ...perScreen] = await Promise.allSettled([
    askClaude(
      SITE_INSTRUCTIONS,
      tileContent(tiles, title, formatMarkups(pages)),
      MAX_OUTPUT_TOKENS
    ),
    ...sources.map((source) => {
      const own = tiles.filter((t) => t.screenId === source.id);
      return askClaude(
        screenInstructions(source.title),
        tileContent(
          own,
          title,
          formatMarkups(pageFor(sourceUrlOf.get(source.id) ?? ""))
        ),
        SCREEN_OUTPUT_TOKENS
      );
    }),
  ]);
  if (site.status === "rejected") {
    throw site.reason;
  }
  const audit = parseAuditReply(site.value, tiles, screenIds);
  const missed: string[] = [];
  for (const [i, result] of perScreen.entries()) {
    if (result.status === "fulfilled") {
      audit.findings.push(
        ...parseAuditReply(result.value, tiles, screenIds).findings
      );
    } else {
      console.error("[ux audit] screen failed", result.reason);
      missed.push(sources[i]?.title ?? `Screen ${i + 1}`);
    }
  }
  if (missed.length === perScreen.length) {
    throw new Error("The audit could not read any of the screens. Try again.");
  }
  if (missed.length > 0) {
    audit.nowFraming =
      `${audit.nowFraming} (Not audited, run again to include: ${missed.join(", ")}.)`.trim();
  }
  return audit;
};

type Block =
  | {
      source: { data: string; media_type: "image/jpeg"; type: "base64" };
      type: "image";
    }
  | { text: string; type: "text" };

/** The tiles as image blocks, each labelled, then the manifest and markup. */
const tileContent = (
  tiles: Tile[],
  title: string | undefined,
  markup: string
): Block[] => {
  const manifest = tiles
    .map(
      (t) =>
        `- ${t.label}: screen "${t.screenTitle}" (screenId: "${t.screenId}", vertical slice ${Math.round(t.top * 100)}%–${Math.round(t.bottom * 100)}%)`
    )
    .join("\n");
  return [
    ...tiles.flatMap((t): Block[] => [
      {
        source: { data: t.data, media_type: "image/jpeg", type: "base64" },
        type: "image",
      },
      {
        text: `Tile ${t.label} — "${t.screenTitle}" (${Math.round(t.top * 100)}%–${Math.round(t.bottom * 100)}% of screen height)`,
        type: "text",
      },
    ]),
    {
      text: `Review title: ${title?.trim() || "Site review"}\n\nTile manifest:\n${manifest}\n\n${markup}\n\nReturn the audit JSON now.`,
      type: "text",
    },
  ];
};

/** One Messages call; resolves with the reply text. */
const askClaude = async (
  instructions: string,
  content: Block[],
  maxTokens: number
): Promise<string> => {
  const headers = await authHeaders();
  const res = await fetch(MESSAGES_URL, {
    body: JSON.stringify({
      max_tokens: maxTokens,
      messages: [{ content, role: "user" }],
      model: AUDIT_MODEL,
      // The four guides are ~15k tokens and identical on every call, so they
      // come first and are cached; the task for this call follows them.
      system: [
        { cache_control: { type: "ephemeral" }, text: REFERENCE, type: "text" },
        { text: instructions, type: "text" },
      ],
    }),
    headers: {
      "anthropic-version": API_VERSION,
      "content-type": "application/json",
      ...headers,
    },
    method: "POST",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(
      `Audit request failed (${res.status}): ${(await res.text()).slice(0, 200)}`
    );
  }
  const body = (await res.json()) as {
    content?: { text?: string; type?: string }[];
    stop_reason?: string;
  };
  // Said plainly, because the alternative is a JSON parse error that reads
  // like a bug in the reply rather than a reply that ran out of room.
  if (body.stop_reason === "max_tokens") {
    throw new Error(
      "The audit ran past its length limit. Try again with fewer screens."
    );
  }
  const reply = (body.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("\n")
    .trim();
  if (!reply) {
    throw new Error("The model returned an empty audit");
  }
  return reply;
};
