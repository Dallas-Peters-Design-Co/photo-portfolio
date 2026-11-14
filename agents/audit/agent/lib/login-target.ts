/**
 * The login page a capture may use, carried on the session's auth.
 *
 * The eve channel reads it from the caller's request (the Review editor's
 * login URL) before the model runs and stores it as an auth attribute, which
 * the model cannot change. The log_in tool reads it back, and types the stored
 * credentials only on that origin, so a page that talks the model into
 * "logging in" somewhere else is refused.
 */
export const LOGIN_URL_ATTRIBUTE = "audit.loginUrl";

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
