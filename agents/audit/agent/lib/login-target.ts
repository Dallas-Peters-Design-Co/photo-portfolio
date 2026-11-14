import { defineState } from "eve/context";

/**
 * Where this session may use the stored test account.
 *
 * Set by the eve channel from the caller's request (the Review editor's login
 * URL) before the model runs, and read by the log_in tool. The model cannot
 * write it: a page that talks the model into "logging in" somewhere else is
 * refused, because the tool only types credentials on this origin.
 */
export const loginTarget = defineState<{ origin: string | null; url: string | null }>(
  "audit.login-target",
  () => ({ origin: null, url: null }),
);

/** The http(s) origin and URL of a login page, or null when it isn't one. */
export function parseLoginUrl(value: unknown): { origin: string; url: string } | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return { origin: parsed.origin, url: parsed.href };
  } catch {
    return null;
  }
}
