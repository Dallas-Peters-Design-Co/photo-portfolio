/**
 * The Browser node's live page, in the desktop app.
 *
 * On the web the node drives a browser on the server, one slow step at a
 * time. Here it embeds a real one (a <webview>): the page loads at full
 * speed, scrolls, takes typing, and stays signed in between sessions. This
 * file is the main-process half: what such an embedded page is allowed to be,
 * and the full-page screenshot the node becomes.
 *
 * An embedded page is someone else's site, so it gets nothing of ours: no
 * preload, no Node, its own storage (so its cookies and the app's never mix),
 * and only http(s) addresses. Windows it tries to open load in place.
 */
import { ipcMain, webContents } from "electron";

/** The embedded pages' own storage: logins persist, apart from the app's. */
export const BROWSER_PARTITION = "persist:review-browser";

/** As tall a page as is captured: past this a screenshot is unusably long. */
const MAX_HEIGHT = 12_000;
/** The widest and tallest picture Chromium will hand back in one piece. */
const MAX_PIXELS = 16_000;

const isWeb = (url) => {
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
};

/** Locks down every <webview> the window's page attaches. */
export const guardWebviews = (win) => {
  win.webContents.on("will-attach-webview", (event, prefs, params) => {
    if (params.partition !== BROWSER_PARTITION || !isWeb(params.src ?? "")) {
      event.preventDefault();
      return;
    }
    // Nothing of the app's goes into the embedded page.
    prefs.preload = undefined;
    prefs.preloadURL = undefined;
    prefs.nodeIntegration = false;
    prefs.nodeIntegrationInSubFrames = false;
    prefs.contextIsolation = true;
    prefs.sandbox = true;
    prefs.webviewTag = false;
  });
  win.webContents.on("did-attach-webview", (_event, guest) => {
    // A link that wants a new window opens where it was clicked.
    guest.setWindowOpenHandler(({ url }) => {
      if (isWeb(url)) {
        guest.loadURL(url).catch(() => undefined);
      }
      return { action: "deny" };
    });
    guest.on("will-navigate", (event, url) => {
      if (!isWeb(url)) {
        event.preventDefault();
      }
    });
  });
};

/** The whole page as a JPEG, through the DevTools protocol. */
const capture = async (guest) => {
  const dbg = guest.debugger;
  const attachedHere = !dbg.isAttached();
  if (attachedHere) {
    dbg.attach("1.3");
  }
  try {
    const { cssContentSize } = await dbg.sendCommand("Page.getLayoutMetrics");
    const width = Math.max(1, Math.ceil(cssContentSize.width));
    const height = Math.min(
      MAX_HEIGHT,
      Math.max(1, Math.ceil(cssContentSize.height))
    );
    // The picture comes out at the screen's own density times `scale`. On a
    // Retina screen that's already twice the page's size; asking for twice
    // again makes a surface too big to draw, which repeats the page in
    // tiles. So: at most two picture pixels per page pixel, and no side
    // longer than Chromium will draw in one piece.
    const { result } = await dbg.sendCommand("Runtime.evaluate", {
      expression: "window.devicePixelRatio",
    });
    const dpr = Number(result?.value) > 0 ? Number(result.value) : 1;
    const density = Math.min(2, dpr, MAX_PIXELS / Math.max(width, height));
    const { data } = await dbg.sendCommand("Page.captureScreenshot", {
      captureBeyondViewport: true,
      clip: { height, scale: density / dpr, width, x: 0, y: 0 },
      format: "jpeg",
      quality: 88,
    });
    return {
      data,
      height: Math.round(height * density),
      title: guest.getTitle(),
      url: guest.getURL(),
      width: Math.round(width * density),
    };
  } finally {
    if (attachedHere) {
      dbg.detach();
    }
  }
};

/**
 * `browser:capture`: only the site may ask, and only for a <webview> of its
 * own window.
 */
export const registerLiveBrowser = (isInsideSite) => {
  ipcMain.handle("browser:capture", (event, id) => {
    if (!isInsideSite(event.senderFrame?.url ?? "")) {
      throw new Error("Screenshots are only available to the site.");
    }
    const guest = typeof id === "number" ? webContents.fromId(id) : null;
    if (
      !guest ||
      guest.getType() !== "webview" ||
      guest.hostWebContents !== event.sender
    ) {
      throw new Error("That page isn't open in this window.");
    }
    return capture(guest);
  });
};
