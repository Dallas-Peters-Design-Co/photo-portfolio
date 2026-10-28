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
const NAV_TIMEOUT_MS = 20_000;
/** How long the page's images and scripts get to finish loading. */
const LOAD_GRACE_MS = 10_000;
const IDLE_GRACE_MS = 3000;

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
    // The HTML first, then a bounded wait for everything else; past either
    // bound the shot is taken as the page stands. Waiting for networkidle
    // outright failed whole captures: analytics, chat widgets and background
    // video keep a page busy forever, and from Vercel's network some sites
    // never fire "load" inside 25s at all — so a site that had drawn its page
    // still timed out and the reviewer got nothing.
    await page.goto(url, {
      timeout: NAV_TIMEOUT_MS,
      waitUntil: "domcontentloaded",
    });
    await page
      .waitForLoadState("load", { timeout: LOAD_GRACE_MS })
      .catch(() => undefined);
    await page
      .waitForLoadState("networkidle", { timeout: IDLE_GRACE_MS })
      .catch(() => undefined);
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
    // Only as far as the shot reaches: an endless feed would otherwise keep
    // growing ahead of the walk until the function ran out of time.
    await page.evaluate(
      ({ step, limit }) =>
        new Promise<void>((done) => {
          let y = 0;
          const tick = () => {
            window.scrollTo(0, y);
            y += step;
            if (y < Math.min(document.documentElement.scrollHeight, limit)) {
              setTimeout(tick, 80);
            } else {
              done();
            }
          };
          tick();
        }),
      { limit: MAX_HEIGHT, step: 400 }
    );
    // A fixed or sticky header is wherever the viewport is when the shot is
    // taken, which after the walk is the bottom of the page. Each fixed
    // element is pinned at its viewport offset from the top of the document
    // instead, which is where a reader at the top of the page sees it. A
    // sticky one goes back into the flow, which is where it sits before any
    // scrolling. Sticky is most headers; handling only fixed left them at
    // the foot of every capture. Set as important so a site's own
    // `position: sticky !important` cannot win.
    await page.evaluate(() => {
      const pin = (node: HTMLElement, values: Record<string, string>) => {
        for (const [name, value] of Object.entries(values)) {
          node.style.setProperty(name, value, "important");
        }
      };
      for (const el of Array.from(document.body.querySelectorAll("*"))) {
        const { position } = getComputedStyle(el);
        const node = el as HTMLElement;
        if (position === "fixed") {
          const rect = el.getBoundingClientRect();
          pin(node, {
            bottom: "auto",
            left: `${rect.left}px`,
            position: "absolute",
            right: "auto",
            top: `${rect.top}px`,
            width: `${rect.width}px`,
          });
        } else if (position === "sticky") {
          pin(node, { bottom: "auto", position: "relative", top: "auto" });
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

export interface PdfInput {
  /** Set in the headless page's localStorage before load: the admin token, so a draft resolves. */
  localStorage?: Record<string, string>;
  url: string;
  /** A selector that means the page has rendered its content. */
  waitFor: string;
}

/**
 * A page as a PDF, the way the browser's own Save as PDF would do it: print
 * media, the page's @page and @media print rules, backgrounds kept. The
 * document is whatever the page shows, so a stylesheet change on the web is
 * a stylesheet change in the PDF with nothing to keep in step.
 */
export const renderPagePdf = async ({
  url,
  waitFor,
  localStorage: storage,
}: PdfInput): Promise<Buffer> => {
  const browser = await launch();
  try {
    const page = await browser.newPage({
      deviceScaleFactor: 2,
      viewport: { height: 1100, width: 1200 },
    });
    if (storage) {
      await page.addInitScript((entries) => {
        for (const [key, value] of Object.entries(entries)) {
          window.localStorage.setItem(key, value);
        }
      }, storage);
    }
    await page.goto(url, { timeout: NAV_TIMEOUT_MS, waitUntil: "networkidle" });
    await page.waitForSelector(waitFor, { timeout: NAV_TIMEOUT_MS });
    await page.evaluate(() => document.fonts.ready);
    await page.emulateMedia({ media: "print" });
    await page.waitForTimeout(300);
    const pdf = await page.pdf({
      format: "Letter",
      preferCSSPageSize: true,
      printBackground: true,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
};
