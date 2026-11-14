import { reviewPassKey } from "../../config/reviewFeedback.js";

/**
 * The pass this browser holds for a password-protected review, kept once
 * the password was right so it isn't asked for again here. Browser storage
 * can be missing or refused (private windows): then the password is just
 * asked for again next time.
 */

export const passFor = (slug: string): string | null => {
  try {
    return window.localStorage.getItem(reviewPassKey(slug));
  } catch {
    return null;
  }
};

export const keepPass = (slug: string, pass: string | null): void => {
  try {
    if (pass) {
      window.localStorage.setItem(reviewPassKey(slug), pass);
    } else {
      window.localStorage.removeItem(reviewPassKey(slug));
    }
  } catch {
    // Not kept; asked for again next visit.
  }
};

/** The header that carries the pass, when there is one. */
export const passHeaders = (slug: string): Record<string, string> => {
  const pass = passFor(slug);
  return pass ? { "X-Review-Pass": pass } : {};
};
