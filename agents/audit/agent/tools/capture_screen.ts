import { randomUUID } from "node:crypto";

import { installAgentBrowser } from "@eve/agent-browser/sandbox";
import { defineTool } from "eve/tools";
import { z } from "zod";

import { BROWSER_SESSION } from "../lib/browser-session";

// Same frames as the review editor's own capture (config/review.ts CAPTURE_WIDTHS).
const VIEWPORTS = {
  desktop: { height: 950, width: 1440 },
  mobile: { height: 844, width: 390 },
} as const;
// Same as the site's own capture (deviceScaleFactor: 2): pictures stay sharp
// on a retina screen and when the review is zoomed.
const PIXEL_SCALE = 2;
// Same cap as the site's capture: an endless feed stops here.
const MAX_HEIGHT = 6000;
const LINK_LIFETIME_MS = 60 * 60 * 1000;
// Absolute: the browser daemon writes the file, and its working directory is
// not the one this tool reads from. A relative path lands somewhere else.
const SHOTS_DIR = "/tmp/eve-shots";
const START_ATTEMPTS = 4;
// One capture at a time. Every capture drives the same browser tab, and two
// at once set the viewport over each other: the phone shot came out at
// desktop width. Tool calls can run in separate processes, so the lock is a
// directory in the shared sandbox; one older than a capture can take is stale.
const LOCK_DIR = "/tmp/eve-shots.lock";
const LOCK_WAIT_MS = 10 * 60 * 1000;
const LOCK_POLL_MS = 1000;
const ACQUIRE_LOCK = `mkdir ${LOCK_DIR} 2>/dev/null || { [ -n "$(find ${LOCK_DIR} -maxdepth 0 -mmin +4 2>/dev/null)" ] && rmdir ${LOCK_DIR} && mkdir ${LOCK_DIR}; }`;
const START_RETRY_MS = 3000;

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

    const why = (r: { stderr: string; stdout: string }) =>
      (r.stderr.trim() || r.stdout.trim()).slice(0, 300);

    const waitUntil = Date.now() + LOCK_WAIT_MS;
    while ((await sandbox.run({ command: ACQUIRE_LOCK, signal })).exitCode !== 0) {
      if (Date.now() > waitUntil) return { ok: false, reason: "Another capture is still running." };
      await new Promise((resolve) => setTimeout(resolve, LOCK_POLL_MS));
    }
    try {
      return await shoot();
    } finally {
      try {
        await sandbox.run({ command: `rmdir ${LOCK_DIR}`, signal });
      } catch {
        // A lock left behind goes stale and is taken over by the next capture.
      }
    }

    async function shoot() {
      // The browser extension installs agent-browser on its first call, which
      // may not have happened yet when this tool runs first.
      const probe = await sandbox.run({ command: "command -v agent-browser", signal });
      if (probe.exitCode !== 0) await installAgentBrowser(sandbox, { abortSignal: signal });

      // The first command in a fresh sandbox starts the browser daemon, and a
      // cold Chrome can outlast the CLI's startup wait. The daemon keeps
      // starting in the background, so a later try finds it.
      let sized = await ab(`set viewport ${frame.width} ${frame.height} ${PIXEL_SCALE}`);
      for (let attempt = 1; sized.exitCode !== 0 && attempt < START_ATTEMPTS; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, START_RETRY_MS));
        sized = await ab(`set viewport ${frame.width} ${frame.height} ${PIXEL_SCALE}`);
      }
      if (sized.exitCode !== 0) {
        return { ok: false, reason: `Could not set the browser size: ${why(sized)}` };
      }
      if (url) {
        const opened = await ab('open "$AB_URL"');
        if (opened.exitCode !== 0) return { ok: false, reason: `Could not open ${url}: ${why(opened)}` };
      } else {
        // The new width can change the layout; reload so it settles.
        await ab("reload");
      }
      await ab("wait --load load");
      await ab("wait 1500");
      await ab('eval "$AB_JS"');
      await ab("wait 1200");

      const file = `${SHOTS_DIR}/${randomUUID()}.png`;
      await sandbox.run({ command: `mkdir -p ${SHOTS_DIR}`, signal });
      const shot = await ab(`screenshot --full ${file}`);
      if (shot.exitCode !== 0) return { ok: false, reason: `The screenshot failed: ${why(shot)}` };
      const bytes = await sandbox.readBinaryFile({ path: file });
      if (!bytes || bytes.byteLength < 24) {
        return { ok: false, reason: `The screenshot file is empty: ${why(shot)}` };
      }
      const sourceUrl = (await ab("get url")).stdout.trim() || url || "";

      // Store privately; hand back only a short-lived, read-only link to this one file.
      // The private review store, shared with the site under the same name.
      // Named explicitly so a stray BLOB_READ_WRITE_TOKEN can never redirect it.
      const token = process.env.REVIEW_BLOB_READ_WRITE_TOKEN?.trim();
      if (!token) return { ok: false, reason: "REVIEW_BLOB_READ_WRITE_TOKEN is not set." };
      const { issueSignedToken, presignUrl, put } = await import("@vercel/blob");
      const pathname = `screens/${randomUUID()}.png`;
      await put(pathname, Buffer.from(bytes), { access: "private", contentType: "image/png", token });
      const validUntil = Date.now() + LINK_LIFETIME_MS;
      const signed = await issueSignedToken({ operations: ["get"], pathname, token, validUntil });
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
    }
  },
});
