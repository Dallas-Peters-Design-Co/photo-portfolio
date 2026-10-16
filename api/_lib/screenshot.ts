import { put } from "@vercel/blob";
import type { Browser } from "playwright-core";
import { blobToken } from "./blobToken.js";

/**
 * A full-page screenshot of a public URL, stored in blob storage.
 *
 * On Vercel the browser is @sparticuz/chromium, a Chromium built to fit a
 * serverless function; locally it is the Chromium the playwright dev
 * dependency installed, found through playwright-core. Both are driven by
 * playwright-core, so the capture code is the same.
 *
 * Height is capped: a long marketing page can run to 30,000px, which is a
 * useless screenshot and a huge PNG. The cap keeps a review's screen to what
 * someone would scroll through.
 */

export interface CaptureInput {
  /** Where in blob storage the file goes, e.g. "reviews/<slug>". */
  prefix: string;
  url: string;
  width: number;
}

export interface CaptureResult {
  height: number;
  url: string;
  width: number;
}

const MAX_HEIGHT = 6000;
const SETTLE_MS = 1200;
const NAV_TIMEOUT_MS = 25_000;

const launch = async (): Promise<Browser> => {
  const { chromium } = await import("playwright-core");
  if (process.env.VERCEL) {
    const sparticuz = (await import("@sparticuz/chromium")).default;
    return chromium.launch({
      args: sparticuz.args,
      executablePath: await sparticuz.executablePath(),
      headless: true,
    });
  }
  // Locally, playwright-core finds the browser the `playwright` package
  // installed; `channel` lets a machine with Chrome and no Playwright
  // download still work.
  try {
    return await chromium.launch({ headless: true });
  } catch {
    return chromium.launch({ channel: "chrome", headless: true });
  }
};

export const captureScreenshot = async ({
  url,
  width,
  prefix,
}: CaptureInput): Promise<CaptureResult> => {
  const browser = await launch();
  try {
    const page = await browser.newPage({
      // The animation-stopping stylesheet below is inline; a site's CSP
      // would refuse it otherwise.
      bypassCSP: true,
      deviceScaleFactor: 2,
      viewport: { height: Math.round(width * 0.66), width },
    });
    await page.goto(url, { timeout: NAV_TIMEOUT_MS, waitUntil: "networkidle" });
    // Reveal-on-scroll sections and lazy images: animations are cut so a
    // reveal completes the moment it fires, then the page is walked once so
    // every observer fires. The walk ends at the bottom on purpose; coming
    // back up un-reveals sections on sites that animate both ways, and the
    // full-page capture does not care where the scroll is.
    await page
      .addStyleTag({
        content:
          "*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition-duration: 0s !important; transition-delay: 0s !important; scroll-behavior: auto !important; }",
      })
      .catch(() => undefined);
    await page.evaluate(
      (step) =>
        new Promise<void>((done) => {
          let y = 0;
          const tick = () => {
            window.scrollTo(0, y);
            y += step;
            if (y < document.documentElement.scrollHeight) {
              setTimeout(tick, 80);
            } else {
              done();
            }
          };
          tick();
        }),
      400
    );
    // A fixed header is wherever the viewport is when the shot is taken,
    // which after the walk is the bottom of the page. Each fixed element is
    // pinned at its viewport offset from the top of the document instead,
    // which is where a reader at the top of the page sees it.
    await page.evaluate(() => {
      for (const el of Array.from(document.body.querySelectorAll("*"))) {
        const style = getComputedStyle(el);
        if (style.position === "fixed") {
          const rect = el.getBoundingClientRect();
          const node = el as HTMLElement;
          node.style.position = "absolute";
          node.style.top = `${rect.top}px`;
          node.style.left = `${rect.left}px`;
          node.style.right = "auto";
          node.style.bottom = "auto";
          node.style.width = `${rect.width}px`;
        }
      }
    });
    await page.waitForTimeout(SETTLE_MS);
    const fullHeight = await page.evaluate(
      () => document.documentElement.scrollHeight
    );
    const height = Math.min(fullHeight, MAX_HEIGHT);
    const png = await page.screenshot({
      clip: { height, width, x: 0, y: 0 },
      fullPage: true,
      type: "png",
    });
    const blob = await put(`${prefix}/${crypto.randomUUID()}.png`, png, {
      access: "public",
      contentType: "image/png",
      token: blobToken(),
    });
    return { height, url: blob.url, width };
  } finally {
    await browser.close();
  }
};
