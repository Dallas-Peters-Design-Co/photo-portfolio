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
import { LAWS_OF_UX } from "./vendor/laws-of-ux.js";
import { SEVERITY_MODEL } from "./vendor/severity-model.js";
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

const SYSTEM_PROMPT = `You are a senior UX/UI auditor preparing a client-facing site review ("audience": "client").

Follow the Tone Guide, Laws of UX, Audit Checklist, and Severity Model below:
- Write in constructive, opportunity-focused client mode ("Then / Now / Next").
- Never use academic law names (use plain-language equivalents from the Tone Guide).
- Ground every finding in what is visibly shown on the screenshot tiles or present in the HTML markup.
- When a finding is visible on a screenshot tile, set "tile" to that tile's label ("T1", "T2", etc.) and set "x" and "y" to the pin's position within that tile as fractions from 0.0 to 1.0 (0,0 is top-left of that tile; 1,1 is bottom-right of that tile). Place pins directly on the element being discussed.
- When a finding is structural or spans the whole site rather than a single spot on a tile, set "tile" to null.

Reply with a single JSON object and nothing else (no markdown fences, no commentary):
{
  "execSummary": "2-4 sentence executive summary for the client.",
  "nowFraming": "1-2 sentences framing what has evolved and why these improvements matter now.",
  "strengths": [
    { "title": "Short title", "detail": "1-2 sentences acknowledging what works well and why." }
  ],
  "principles": [
    {
      "name": "Plain-language principle name",
      "status": "pass" | "opportunity" | "attention",
      "detail": "1-2 sentences on how the site measures up."
    }
  ],
  "recommendations": [
    { "title": "Actionable next step", "detail": "1-2 sentences on what to do and what the client gains." }
  ],
  "findings": [
    {
      "tile": "T1",
      "x": 0.45,
      "y": 0.32,
      "kind": "issue" | "recommendation" | "suggestion" | "praise",
      "area": "Navigation | Hierarchy | Typography | Contrast | Mobile | Forms | Clarity | Accessibility",
      "headline": "Short, constructive title",
      "detail": "2-3 sentences pairing what was observed with what it means for visitors."
    }
  ]
}

Aim for 4-6 strengths, 6-10 principles, 4-6 recommendations, and 6-14 findings across the provided screens.

---
${TONE_GUIDE}
---
${SEVERITY_MODEL}
---
${AUDIT_CHECKLIST}
---
${LAWS_OF_UX}`;

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

  const manifest = tiles
    .map(
      (t) =>
        `- ${t.label}: screen "${t.screenTitle}" (screenId: "${t.screenId}", vertical slice ${Math.round(t.top * 100)}%–${Math.round(t.bottom * 100)}%)`
    )
    .join("\n");

  const content = [
    ...tiles.flatMap((t) => [
      {
        source: {
          data: t.data,
          media_type: "image/jpeg" as const,
          type: "base64" as const,
        },
        type: "image" as const,
      },
      {
        text: `Tile ${t.label} — "${t.screenTitle}" (${Math.round(t.top * 100)}%–${Math.round(t.bottom * 100)}% of screen height)`,
        type: "text" as const,
      },
    ]),
    {
      text: `Review title: ${title?.trim() || "Site review"}\n\nTile manifest:\n${manifest}\n\n${formatMarkups(pages)}\n\nReturn the audit JSON now.`,
      type: "text" as const,
    },
  ];

  const headers = await authHeaders();
  const res = await fetch(MESSAGES_URL, {
    body: JSON.stringify({
      max_tokens: MAX_OUTPUT_TOKENS,
      messages: [{ content, role: "user" }],
      model: AUDIT_MODEL,
      // The four guides are ~15k tokens and identical on every run, so they
      // are cached rather than paid for in full each time.
      system: [
        {
          cache_control: { type: "ephemeral" },
          text: SYSTEM_PROMPT,
          type: "text",
        },
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
  return parseAuditReply(
    reply,
    tiles,
    sources.map((s) => s.id)
  );
};
