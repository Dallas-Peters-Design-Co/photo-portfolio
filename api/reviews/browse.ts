import type { VercelRequest, VercelResponse } from "@vercel/node";
import { CAPTURE_WIDTHS } from "../../config/review.js";
import { getBearerUser } from "../_lib/auth.js";
import { type BrowserLogin, browse, type Session } from "../_lib/browse.js";
import { handleCors } from "../_lib/cors.js";
import { parsePublicHttpUrl, sanitizeText } from "../_lib/httpUrl.js";
import { parseJsonBody } from "../_lib/parseBody.js";
import { resolvePublicUrl } from "../_lib/publicHost.js";
import { seal, unseal } from "../_lib/sealed.js";

/**
 * The board's browser node (src/boards/nodes/BrowserNode.tsx).
 *
 *   seal     a login, typed once, sealed so the board can keep it without
 *            being able to read it (_lib/sealed.ts). Only the username comes
 *            back in the clear, for the node to show whose login it is.
 *   step     open a page, signed in, maybe click or type, and return a
 *            preview to click on next, with the session to carry on with.
 *   capture  the same, ending in a full-page screenshot stored as an image.
 *
 * Admin only: it drives a real browser with saved credentials.
 */

export const config = { maxDuration: 60 };

const TIMEOUT = /timeout/i;
const MAX_FIELD = 500;

const field = (v: unknown): string =>
  typeof v === "string" ? sanitizeText(v).slice(0, MAX_FIELD) : "";

const point = (v: unknown): { x: number; y: number } | null => {
  const raw = (v ?? null) as { x?: unknown; y?: unknown } | null;
  const x = Number(raw?.x);
  const y = Number(raw?.y);
  return raw && Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0
    ? { x, y }
    : null;
};

const publicUrl = async (raw: unknown): Promise<string | null> => {
  const parsed = typeof raw === "string" ? parsePublicHttpUrl(raw) : null;
  if (!parsed) {
    return null;
  }
  const checked = await resolvePublicUrl(parsed);
  return checked.ok ? checked.url.href : null;
};

const sealLogin = async (
  body: Record<string, unknown>,
  res: VercelResponse
) => {
  const raw = (body.login ?? {}) as Record<string, unknown>;
  const username = field(raw.username);
  // A password is taken as typed: trimming it would change it.
  const password =
    typeof raw.password === "string" ? raw.password.slice(0, MAX_FIELD) : "";
  if (!(username && password)) {
    return res.status(400).json({ error: "Enter a username and a password" });
  }
  const loginUrl = raw.loginUrl ? await publicUrl(raw.loginUrl) : "";
  if (loginUrl === null) {
    return res
      .status(400)
      .json({ error: "The sign-in page needs a full https:// address" });
  }
  const login: BrowserLogin = { loginUrl, password, username };
  return res.status(200).json({ sealedLogin: seal(login), username });
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) {
    return;
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!getBearerUser(req.headers.authorization)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const body = parseJsonBody(req.body);
  if (body.action === "seal") {
    return sealLogin(body, res);
  }
  const url = await publicUrl(body.url);
  if (!url) {
    return res.status(400).json({ error: "Enter a full https:// address" });
  }
  const login = body.sealedLogin
    ? unseal<BrowserLogin>(body.sealedLogin)
    : null;
  if (body.sealedLogin && !login) {
    return res
      .status(409)
      .json({
        error: "The saved login can't be opened any more. Enter it again.",
      });
  }
  const session = unseal<Session>(body.session);
  const viewport = body.viewport === "mobile" ? "mobile" : "desktop";
  const slug = field(body.slug).replace(/[^a-z0-9-]/g, "");
  try {
    const result = await browse({
      capturePrefix:
        body.action === "capture"
          ? `boards/browser/${slug || "page"}`
          : undefined,
      click: point(body.click),
      login,
      pressEnter: body.enter === true,
      session,
      text: typeof body.text === "string" ? body.text : "",
      url,
      width: CAPTURE_WIDTHS[viewport],
    });
    return res.status(200).json({ ...result, session: seal(result.session) });
  } catch (e) {
    console.error("[browser node]", e);
    const msg = e instanceof Error ? e.message : "";
    return res.status(TIMEOUT.test(msg) ? 504 : 502).json({
      error: TIMEOUT.test(msg)
        ? "That page took too long to load. Try again."
        : "The browser couldn't open that page.",
    });
  }
}
