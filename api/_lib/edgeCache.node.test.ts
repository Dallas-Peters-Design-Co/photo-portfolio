import type { VercelRequest, VercelResponse } from "@vercel/node";
import { describe, expect, it } from "vitest";
import { cachePublicRead } from "./edgeCache.js";

const run = (req: Partial<VercelRequest>, opts = { fresh: 30, stale: 600 }) => {
  const headers: Record<string, string> = {};
  const res = {
    setHeader: (k: string, v: string) => {
      headers[k.toLowerCase()] = v;
      return res;
    },
  } as unknown as VercelResponse;
  cachePublicRead(
    { headers: {}, query: {}, ...req } as VercelRequest,
    res,
    opts
  );
  return headers;
};

describe("cachePublicRead", () => {
  it("lets Vercel's edge cache an anonymous read, and keeps the browser asking", () => {
    const h = run({});
    expect(h["vercel-cdn-cache-control"]).toBe(
      "max-age=30, stale-while-revalidate=600"
    );
    expect(h["cache-control"]).toBe("public, max-age=0, must-revalidate");
  });

  it("never stores a signed-in read", () => {
    const h = run({ headers: { authorization: "Bearer t" } });
    expect(h["cache-control"]).toBe("private, no-store");
    expect(h["vercel-cdn-cache-control"]).toBeUndefined();
  });

  it("never stores the admin's URL, even without a token on it", () => {
    // Otherwise a stranger requesting ?scope=admin would put the public list
    // in the cache under the admin's key.
    const h = run({ query: { scope: "admin" } });
    expect(h["cache-control"]).toBe("private, no-store");
    expect(h["vercel-cdn-cache-control"]).toBeUndefined();
  });

  it("passes a browser max-age through when asked", () => {
    const h = run({}, { browser: 30, fresh: 30, stale: 600 } as never);
    expect(h["cache-control"]).toBe("public, max-age=30");
  });
});
