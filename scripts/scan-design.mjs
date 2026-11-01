#!/usr/bin/env node

/**
 * Scans a brand's live websites for its DESIGN.md.
 *
 * Opens each site in Chromium at desktop size, reads the components as the
 * browser draws them (buttons, links, inputs, cards, nav, footer, badges),
 * the h1–h4/body/small type scale, and the radii and spacing the page
 * repeats, then saves it all to the kit through the site connector. The next
 * DESIGN.md (download, connector or vault sync) includes it.
 *
 *   pnpm design-md:scan "Unruly Chain"                   the kit's websites
 *   pnpm design-md:scan "Unruly Chain" https://site.com   add and scan a site
 *   pnpm design-md:scan --all                            every kit with sites
 *   pnpm design-md:scan --dry https://site.com           print, save nothing
 *
 * Needs MCP_ACCESS_TOKEN in .env.local, and a Chromium for Playwright
 * (`npx playwright install chromium`) or Google Chrome installed.
 */

import { chromium } from "playwright";
import { scanPage } from "./scanPage.mjs";
import { connector } from "./siteConnector.mjs";

const HTTP = /^https?:\/\//i;

const launch = async () => {
  try {
    return await chromium.launch();
  } catch {
    // No Playwright browser downloaded: use the installed Chrome.
    return await chromium.launch({ channel: "chrome" });
  }
};

export const scanUrl = async (browser, url) => {
  const page = await browser.newPage({
    viewport: { height: 900, width: 1440 },
  });
  try {
    try {
      await page.goto(url, { timeout: 45_000, waitUntil: "networkidle" });
    } catch {
      // Sites that never go quiet (analytics, video): the load event will do.
      await page.goto(url, { timeout: 45_000, waitUntil: "load" });
    }
    await page.waitForTimeout(800);
    const found = await page.evaluate(scanPage);
    return { ...found, scannedAt: new Date().toISOString(), url: page.url() };
  } finally {
    await page.close();
  }
};

const summary = (scan) =>
  `${scan.url}: ${scan.components.map((c) => c.name).join(", ") || "no components"}; type ${scan.typography.map((t) => t.name).join("/")}; radii ${scan.rounded.join(" ") || "none"}; spacing ${scan.spacing.join(" ") || "none"}`;

const scanKit = async (browser, call, kit, extra) => {
  const found = await call("get_brand_kit", { kit });
  const urls = [...new Set([...(found.brand.websites ?? []), ...extra])];
  if (urls.length === 0) {
    console.log(
      `${found.name}: no websites. Add one in the kit, or pass a URL.`
    );
    return;
  }
  const scans = [];
  for (const url of urls) {
    try {
      // biome-ignore lint/performance/noAwaitInLoops: one site at a time, one browser tab
      const scan = await scanUrl(browser, url);
      scans.push(scan);
      console.log(`  ${summary(scan)}`);
    } catch (e) {
      console.error(`  ${url}: ${e instanceof Error ? e.message : e}`);
    }
  }
  if (scans.length > 0) {
    const out = await call("set_brand_scan", {
      kit: found.id,
      scans,
      websites: urls,
    });
    console.log(
      `${found.name}: saved ${scans.length} scan(s) as version ${out.version}`
    );
  }
};

const main = async () => {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const all = args.includes("--all");
  const urls = args.filter((a) => HTTP.test(a));
  const [kit] = args.filter((a) => !(a.startsWith("--") || HTTP.test(a)));

  const browser = await launch();
  try {
    if (dry) {
      for (const url of urls) {
        // biome-ignore lint/performance/noAwaitInLoops: one site at a time
        console.log(JSON.stringify(await scanUrl(browser, url), null, 2));
      }
      return;
    }
    const call = connector();
    if (all) {
      for (const k of await call("list_brand_kits", {})) {
        // biome-ignore lint/performance/noAwaitInLoops: one kit at a time
        await scanKit(browser, call, k.id, []);
      }
      return;
    }
    if (!kit) {
      throw new Error('Say which kit: pnpm design-md:scan "Unruly Chain"');
    }
    await scanKit(browser, call, kit, urls);
  } finally {
    await browser.close();
  }
};

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
