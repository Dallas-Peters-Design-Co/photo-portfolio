import { describe, expect, it } from "vitest";
import { applySiteOverrides, resolveSite, SITES } from "./sites";

/**
 * Where a site's mail comes from.
 *
 * A proposal's signed copy goes to a client from `emailFrom`. The sites share
 * one codebase, and dallas-images began life as a copy of addison, so for a
 * while a client of Dallas's got mail "from Addison's Photos". The env var
 * `SITE_EMAIL_FROM` covered it locally and hid that the compiled default was
 * wrong, which is exactly the case a production deploy without that variable
 * would hit. These pin the defaults down per site.
 */

const AT_DOMAIN = /@([^>\s]+)/;
const ADDISON = /addisonsphotos/i;

const domainOf = (from: string): string => from.match(AT_DOMAIN)?.[1] ?? "";

describe("site email identity", () => {
  it("sends each site's mail from its own domain", () => {
    for (const site of Object.values(SITES)) {
      expect(domainOf(site.emailFrom), site.key).toBe(site.domain);
    }
  });

  it("dallas-images does not borrow Addison's address for anything", () => {
    const site = SITES["dallas-images"];
    expect(site.emailFrom).not.toMatch(ADDISON);
    expect(site.defaultAdminEmail).toBe("dallaspeters@gmail.com");
    expect(site.ownerName).toBe("Dallas");
  });

  it("SITE_EMAIL_FROM overrides the compiled default, blank does not", () => {
    const base = resolveSite("dallas-images");
    expect(
      applySiteOverrides(base, {
        SITE_EMAIL_FROM: "Dallas Peters <hello@dallaspeters.com>",
      }).emailFrom
    ).toBe("Dallas Peters <hello@dallaspeters.com>");
    expect(applySiteOverrides(base, { SITE_EMAIL_FROM: "  " }).emailFrom).toBe(
      base.emailFrom
    );
  });
});
