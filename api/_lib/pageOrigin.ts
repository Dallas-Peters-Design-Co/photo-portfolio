import { getSite } from "./site.js";

/**
 * The origin a headless browser may be pointed at to print one of the site's
 * own pages (a proposal, a review).
 *
 * The request says which origin it came from; that origin is accepted only
 * when the site serves it, or when it is localhost off Vercel, so a PDF route
 * can never be used to render someone else's page.
 */

const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const TRAILING_SLASH = /\/$/;

export const allowedPageOrigin = (raw: unknown): string | null => {
  if (typeof raw !== "string") {
    return null;
  }
  const origin = raw.replace(TRAILING_SLASH, "");
  if (getSite().origins.includes(origin)) {
    return origin;
  }
  if (!process.env.VERCEL && LOCAL_ORIGIN.test(origin)) {
    return origin;
  }
  return null;
};

/** Where the admin token lives in the browser, so a draft resolves there too. */
export const ADMIN_TOKEN_KEY = "cyan_admin_token";
