import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Lets Vercel's CDN serve a public read without running the function.
 *
 * Every request to these endpoints used to run a function and a database
 * query, 200-300 ms each, for answers that are the same for every visitor.
 * With this the edge answers from cache: fresh for `fresh` seconds, then served
 * stale for up to `stale` more while one request refreshes it in the
 * background. So a change made in the admin reaches visitors within about
 * `fresh` seconds, and no visitor waits on the database.
 *
 * The CDN keys on the URL, not on the Authorization header, so a signed-in
 * request must never share a URL with a cached public one. The admin client
 * marks its reads with `?scope=admin`; those, and anything carrying a token,
 * are answered `private, no-store` and never stored.
 *
 * Vercel-CDN-Cache-Control is read by Vercel's edge only. The browser gets the
 * separate `browser` max-age (0 by default, so it always asks the edge, which
 * is fast).
 */
export const cachePublicRead = (
  req: VercelRequest,
  res: VercelResponse,
  {
    fresh,
    stale,
    browser = 0,
  }: { fresh: number; stale: number; browser?: number }
): void => {
  if (req.headers.authorization || req.query.scope !== undefined) {
    res.setHeader("Cache-Control", "private, no-store");
    return;
  }
  res.setHeader(
    "Cache-Control",
    browser > 0
      ? `public, max-age=${browser}`
      : "public, max-age=0, must-revalidate"
  );
  res.setHeader(
    "Vercel-CDN-Cache-Control",
    `max-age=${fresh}, stale-while-revalidate=${stale}`
  );
};
