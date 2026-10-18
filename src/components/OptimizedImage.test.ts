import { describe, expect, it } from "vitest";
import vercelConfig from "../../vercel.json?raw";
import { OPTIMIZER_HOSTS } from "./OptimizedImage";

/**
 * The client's list of optimizable hosts and vercel.json's must match exactly.
 *
 * A host missing from vercel.json is rewritten to /_vercel/image and refused
 * with a 400 — a broken picture on the live site only. A host missing from the
 * client list is merely served unoptimized. Either drift is a bug, and only one
 * of them is visible in development.
 */
describe("OPTIMIZER_HOSTS", () => {
  it("matches images.remotePatterns in vercel.json", () => {
    const config = JSON.parse(vercelConfig) as {
      images: { remotePatterns: { hostname: string }[] };
    };
    const configured = config.images.remotePatterns
      .map((p) => p.hostname)
      .sort();
    expect([...OPTIMIZER_HOSTS].sort()).toEqual(configured);
  });

  it("includes Pinterest's image host", () => {
    expect(OPTIMIZER_HOSTS).toContain("i.pinimg.com");
  });
});
