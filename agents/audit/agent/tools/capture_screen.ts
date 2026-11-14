import { randomUUID } from "node:crypto";

import { defineTool } from "eve/tools";
import { z } from "zod";

import { BROWSER_SESSION } from "../lib/browser-session";

// Same frames as the review editor's own capture (config/review.ts CAPTURE_WIDTHS).
const VIEWPORTS = {
  desktop: { height: 950, width: 1440 },
  mobile: { height: 844, width: 390 },
} as const;
// Same cap as the site's capture: an endless feed stops here.
const MAX_HEIGHT = 6000;
const LINK_LIFETIME_MS = 60 * 60 * 1000;

// Prepares the page the way the site's own capture does: cut animations, walk
// the page so lazy content loads, pin fixed and sticky elements where a reader
// at the top sees them, and cap the height.
const PREPARE_PAGE_JS = `(async () => {
  const style = document.createElement("style");
  style.textContent = "*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition-duration: 0s !important; transition-delay: 0s !important; scroll-behavior: auto !important; }";
  document.head.appendChild(style);
  const limit = Math.min(document.documentElement.scrollHeight, ${MAX_HEIGHT});
  for (let y = 0; y < limit; y += 400) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 80));
  }
  const pin = (node, values) => {
    for (const [name, value] of Object.entries(values)) node.style.setProperty(name, value, "important");
  };
  for (const el of Array.from(document.body.querySelectorAll("*"))) {
    const { position } = getComputedStyle(el);
    if (position === "fixed") {
      const rect = el.getBoundingClientRect();
      pin(el, { bottom: "auto", left: rect.left + "px", position: "absolute", right: "auto", top: rect.top + "px", width: rect.width + "px" });
    } else if (position === "sticky") {
      pin(el, { bottom: "auto", position: "relative", top: "auto" });
    }
  }
  window.scrollTo(0, 0);
  if (document.documentElement.scrollHeight > ${MAX_HEIGHT}) {
    pin(document.documentElement, { height: "${MAX_HEIGHT}px", overflow: "hidden" });
    pin(document.body, { height: "${MAX_HEIGHT}px", overflow: "hidden" });
  }
  return document.documentElement.scrollHeight;
})()`;

/** Width and height from a PNG's IHDR chunk. */
function pngSize(bytes: Uint8Array): { height: number; width: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { height: view.getUint32(20), width: view.getUint32(16) };
}

export default defineTool({
  description:
    "Take a full-page screenshot of one page for the client review and store it. " +
    "Uses the same browser session as browser__* tools, so it stays logged in. " +
    "Pass url to open a page first, or omit it to capture the page that is open now. " +
    "Returns a read-only image link; copy it exactly into your result.",
  inputSchema: z.object({
    title: z.string().min(1).max(160).describe("Short screen title, e.g. 'Dashboard'."),
    url: z.string().url().optional().describe("Page to open before capturing."),
    viewport: z.enum(["desktop", "mobile"]),
  }),
  async execute({ title, url, viewport }, ctx) {
    const sandbox = await ctx.getSandbox();
    const signal = ctx.abortSignal;
    const frame = VIEWPORTS[viewport];
    const env = { AB_URL: url ?? "", AB_JS: PREPARE_PAGE_JS };
    const ab = (args: string) =>
      sandbox.run({ command: `agent-browser --session ${BROWSER_SESSION} ${args}`, env, signal });

    const sized = await ab(`set viewport ${frame.width} ${frame.height}`);
    if (sized.exitCode !== 0) return { ok: false, reason: "Could not set the browser size." };
    if (url) {
      const opened = await ab('open "$AB_URL"');
      if (opened.exitCode !== 0) return { ok: false, reason: `Could not open ${url}.` };
    } else {
      // The new width can change the layout; reload so it settles.
      await ab("reload");
    }
    await ab("wait --load load");
    await ab("wait 1500");
    await ab('eval "$AB_JS"');
    await ab("wait 1200");

    const file = `.eve/shots/${randomUUID()}.png`;
    await sandbox.run({ command: "mkdir -p .eve/shots", signal });
    const shot = await ab(`screenshot --full ${file}`);
    if (shot.exitCode !== 0) return { ok: false, reason: "The screenshot failed." };
    const bytes = await sandbox.readBinaryFile({ path: file });
    if (!bytes || bytes.byteLength < 24) return { ok: false, reason: "The screenshot file is empty." };
    const sourceUrl = (await ab("get url")).stdout.trim() || url || "";

    // Store privately; hand back only a short-lived, read-only link to this one file.
    const { issueSignedToken, presignUrl, put } = await import("@vercel/blob");
    const pathname = `screens/${randomUUID()}.png`;
    await put(pathname, Buffer.from(bytes), { access: "private", contentType: "image/png" });
    const validUntil = Date.now() + LINK_LIFETIME_MS;
    const signed = await issueSignedToken({ operations: ["get"], pathname, validUntil });
    const { presignedUrl } = await presignUrl(signed, {
      access: "private",
      operation: "get",
      pathname,
      validUntil,
    });

    const px = pngSize(bytes);
    // Report CSS pixels, like the site's own capture does.
    const scale = px.width / frame.width || 1;
    return {
      image: {
        height: Math.round(px.height / scale),
        url: presignedUrl,
        width: frame.width,
      },
      ok: true,
      sourceUrl,
      title,
      viewport,
    };
  },
});
