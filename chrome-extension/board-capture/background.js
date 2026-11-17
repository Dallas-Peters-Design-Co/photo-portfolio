/**
 * Board Capture: screenshots the active tab and hands the picture to a board
 * open in another tab (see bridge.js for how it gets in).
 *
 * Pictures are taken with Chrome's own "capture visible tab", of your tab as
 * you see it, so signed-in pages work and nothing is debugged.
 */
const BOARD_HOSTS = [
  "https://www.dallaspeters.com/*",
  "https://dallaspeters.com/*",
  "https://app.dallaspeters.com/*",
  "http://localhost/*",
];
/** Pages a screenshot can be taken of. */
const WEB_PAGE = /^https?:/;
/** As tall a page as is captured: past this a screenshot is unusably long. */
const MAX_HEIGHT = 12_000;
/** The largest side Chromium hands back in one picture. */
const MAX_PIXELS = 16_000;

const wait = (ms) => new Promise((done) => setTimeout(done, ms));

/** Runs a function in the page and returns what it returns. */
const inPage = async (tabId, func, args = []) => {
  const [result] = await chrome.scripting.executeScript({
    args,
    func,
    target: { tabId },
  });
  return result?.result;
};

/** Chrome allows two visible-tab captures a second. */
const BETWEEN_SHOTS_MS = 550;

/**
 * The whole page: scroll it a screen at a time, photograph each, and join
 * them.
 *
 * Chrome's own "capture beyond the viewport" isn't used. On a Retina screen
 * it repeated the top of the page in tiles down the picture, and Chrome
 * refuses it outright on a tab another extension has put a frame in. Joining
 * screens is slower and you see the page scroll, but the picture is the page.
 * After the first screen, anything fixed or sticky is hidden, so a header
 * appears once at the top and not on every screen; it's put back when the
 * capture ends.
 */
const stitch = async (tab, whole) => {
  const page = await inPage(tab.id, () => ({
    dpr: window.devicePixelRatio || 1,
    full: Math.max(
      document.documentElement.scrollHeight,
      document.body?.scrollHeight ?? 0
    ),
    // The photograph is of the whole window, scrollbar included.
    innerW: window.innerWidth,
    left: window.scrollX,
    top: window.scrollY,
    viewH: window.innerHeight,
    viewW: document.documentElement.clientWidth,
  }));
  const height = whole ? Math.min(page.full, MAX_HEIGHT) : page.viewH;
  const first = whole ? 0 : page.top;
  // Small enough for one canvas, and never more than the screen gives.
  const scale = Math.min(page.dpr, MAX_PIXELS / Math.max(height, page.viewW));
  const canvas = new OffscreenCanvas(
    Math.round(page.viewW * scale),
    Math.round(height * scale)
  );
  const ctx = canvas.getContext("2d");
  // How much of the page, in its own pixels, has been joined on.
  let done = 0;
  try {
    while (done < height) {
      const wanted = first + done;
      // The page may not scroll that far (the last screen): ask where it got.
      // biome-ignore lint/performance/noAwaitInLoops: each screen is scrolled to, then shot, in order; the tab shows one at a time
      const at = await inPage(
        tab.id,
        (y, hide) => {
          if (hide) {
            for (const el of document.querySelectorAll("body *")) {
              const { position } = getComputedStyle(el);
              // Once each: a second pass would save "hidden" as its own.
              if (
                (position === "fixed" || position === "sticky") &&
                el.dataset.boardCaptureHidden === undefined
              ) {
                el.dataset.boardCaptureHidden = el.style.visibility;
                el.style.setProperty("visibility", "hidden", "important");
              }
            }
          }
          window.scrollTo({ behavior: "instant", left: 0, top: y });
          return window.scrollY;
        },
        [wanted, whole && done > 0]
      );
      await wait(done === 0 ? 150 : BETWEEN_SHOTS_MS);
      const shot = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: "png",
      });
      const bitmap = await createImageBitmap(await (await fetch(shot)).blob());
      // How far into this screen the next unpainted row is.
      const skip = wanted - at;
      const rows = Math.min(page.viewH - skip, height - done);
      if (rows <= 0) {
        // The page won't scroll that far (it scrolls inside a panel, or it
        // shrank): what's been joined so far is the picture.
        bitmap.close();
        break;
      }
      const k = bitmap.width / page.innerW;
      ctx.drawImage(
        bitmap,
        0,
        skip * k,
        page.viewW * k,
        rows * k,
        0,
        done * scale,
        page.viewW * scale,
        rows * scale
      );
      bitmap.close();
      done += rows;
    }
  } finally {
    await inPage(
      tab.id,
      (left, top) => {
        for (const el of document.querySelectorAll(
          "[data-board-capture-hidden]"
        )) {
          el.style.visibility = el.dataset.boardCaptureHidden;
          delete el.dataset.boardCaptureHidden;
        }
        window.scrollTo({ behavior: "instant", left, top });
      },
      [page.left, page.top]
    ).catch(() => undefined);
  }
  // Shorter than planned (the page stopped scrolling): keep what was joined.
  let out = canvas;
  if (done > 0 && done < height) {
    out = new OffscreenCanvas(canvas.width, Math.round(done * scale));
    out.getContext("2d").drawImage(canvas, 0, 0);
  }
  const blob = await out.convertToBlob({ quality: 0.88, type: "image/jpeg" });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const CHUNK = 0x80_00;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return { data: btoa(binary), height: out.height, width: out.width };
};

/** Just what's on screen, with no script run in the page at all. */
const visible = async (tab) => {
  // Clear of any capture the scrolling way just made (two a second).
  await wait(BETWEEN_SHOTS_MS * 2);
  const shot = await chrome.tabs.captureVisibleTab(tab.windowId, {
    format: "jpeg",
    quality: 88,
  });
  const bitmap = await createImageBitmap(await (await fetch(shot)).blob());
  const size = { height: bitmap.height, width: bitmap.width };
  bitmap.close();
  return { data: shot.slice(shot.indexOf(",") + 1), ...size };
};

/**
 * The picture asked for: the whole page joined from its screens, or what's
 * on screen. If the page can't be scrolled by the extension, the whole page
 * falls back to what's on screen, and says so.
 */
const shoot = async (tab, whole) => {
  if (!whole) {
    return { ...(await visible(tab)), way: "screen" };
  }
  try {
    return { ...(await stitch(tab, true)), way: "scrolling" };
  } catch (scrolling) {
    try {
      return { ...(await visible(tab)), way: "screen" };
    } catch (screen) {
      throw new Error(
        `scrolling: ${scrolling?.message ?? scrolling} · screen: ${screen?.message ?? screen}`,
        { cause: screen }
      );
    }
  }
};

const ask = (tabId, message) =>
  chrome.tabs.sendMessage(tabId, { ...message, to: "board" }).catch(() => ({
    error: "Reload the board tab once, so it can hear the extension.",
    ok: false,
  }));

/** Tabs with a board open and listening, each with the board's name. */
const openBoards = async () => {
  const tabs = await chrome.tabs.query({ url: BOARD_HOSTS });
  const answers = await Promise.all(
    tabs.map(async (tab) => ({
      answer: await ask(tab.id, { type: "ping" }),
      tab,
    }))
  );
  return answers
    .filter(({ answer }) => answer?.ok)
    .map(({ answer, tab }) => ({
      name: answer.board || tab.title,
      tabId: tab.id,
    }));
};

const captureToBoard = async ({ boardTabId, whole }) => {
  const [tab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });
  if (!(tab?.id && WEB_PAGE.test(tab.url ?? ""))) {
    return { error: "This page can't be captured.", ok: false };
  }
  const boards = await openBoards();
  const board = boards.find((b) => b.tabId === boardTabId) ?? boards[0];
  if (!board) {
    return { error: "Open a board in a tab first.", ok: false };
  }
  if (board.tabId === tab.id) {
    return { error: "Switch to the page you want to capture.", ok: false };
  }
  let shot;
  try {
    shot = await shoot(tab, whole);
  } catch (e) {
    return {
      error: `Couldn't capture this page: ${e?.message ?? e}`,
      ok: false,
    };
  }
  const { way: _way, ...picture } = shot;
  const answer = await ask(board.tabId, {
    ...picture,
    title: tab.title ?? "",
    type: "capture",
    url: tab.url,
  });
  if (!answer?.ok) {
    return answer;
  }
  // Only what was on screen could be taken, when the whole page was asked for.
  const partial = whole && shot.way === "screen";
  return { board: board.name, ok: true, partial };
};

chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message?.to !== "background") {
    return;
  }
  const work =
    message.type === "boards" ? openBoards() : captureToBoard(message);
  work.then(respond, (e) =>
    respond({ error: String(e?.message ?? e), ok: false })
  );
  return true;
});

// The keyboard shortcut: the whole page, to the first open board.
chrome.commands.onCommand.addListener((command) => {
  if (command === "capture-full") {
    captureToBoard({ whole: true }).then((result) => {
      chrome.action.setBadgeText({ text: result.ok ? "✓" : "!" });
      setTimeout(() => chrome.action.setBadgeText({ text: "" }), 2500);
    });
  }
});

/*
 * Collections: right-click any image and save it to one.
 *
 * Asked of any open dallaspeters.com tab (bridge.js), which saves it as the
 * signed-in admin and copies the picture into the site's store
 * (src/components/ExtensionCollections.tsx). The list of collections is kept
 * here to build the menu; it's refreshed from the popup or the menu.
 */

/** Asks each site tab in turn until one answers. */
const askSite = async (message) => {
  const tabs = await chrome.tabs.query({ url: BOARD_HOSTS });
  let last = {
    error: "Open dallaspeters.com in a tab and sign in.",
    ok: false,
  };
  for (const tab of tabs) {
    // biome-ignore lint/performance/noAwaitInLoops: one tab at a time, the first that answers wins
    const answer = await ask(tab.id, message);
    if (answer?.ok) {
      return answer;
    }
    last = answer ?? last;
  }
  return last;
};

const stored = async () => {
  const { collections = [], defaultId = null } = await chrome.storage.local.get(
    ["collections", "defaultId"]
  );
  return { collections, defaultId };
};

const buildMenus = async () => {
  const { collections, defaultId } = await stored();
  await chrome.contextMenus.removeAll();
  const menu = (item) =>
    chrome.contextMenus.create({ contexts: ["image"], ...item });
  menu({ id: "save", title: "Save image to collection" });
  const first = collections.find((c) => c.id === defaultId);
  if (first) {
    menu({ id: `col:${first.id}`, parentId: "save", title: first.name });
    menu({ id: "sep-1", parentId: "save", type: "separator" });
  }
  for (const c of collections) {
    if (c.id !== first?.id) {
      menu({ id: `col:${c.id}`, parentId: "save", title: c.name });
    }
  }
  if (collections.length === 0) {
    menu({
      enabled: false,
      id: "none",
      parentId: "save",
      title: "No collections yet: sign in on dallaspeters.com",
    });
  }
  menu({ id: "sep-2", parentId: "save", type: "separator" });
  menu({ id: "refresh", parentId: "save", title: "Refresh collections" });
};

const loadCollections = async () => {
  const answer = await askSite({ type: "collections" });
  if (answer?.ok) {
    await chrome.storage.local.set({ collections: answer.collections });
    await buildMenus();
  }
  return { ...(await stored()), error: answer?.ok ? null : answer?.error };
};

const flash = (ok) => {
  chrome.action.setBadgeText({ text: ok ? "✓" : "!" });
  setTimeout(() => chrome.action.setBadgeText({ text: "" }), 2500);
};

const saveImage = async (collectionId, srcUrl, tab) => {
  if (!WEB_PAGE.test(srcUrl ?? "")) {
    flash(false);
    return { error: "That image can't be saved from here.", ok: false };
  }
  const answer = await askSite({
    collectionId,
    title: tab?.title ?? "",
    type: "save-image",
    url: srcUrl,
  });
  if (answer?.ok) {
    await chrome.storage.local.set({ defaultId: collectionId });
    await buildMenus();
  }
  flash(Boolean(answer?.ok));
  return answer;
};

chrome.runtime.onInstalled.addListener(() => void buildMenus());
chrome.runtime.onStartup.addListener(() => void buildMenus());

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const id = String(info.menuItemId);
  if (id === "refresh") {
    loadCollections().then((r) => flash(!r.error));
  } else if (id.startsWith("col:")) {
    saveImage(id.slice(4), info.srcUrl, tab);
  }
});

// The popup's collection picker.
chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message?.to !== "collections") {
    return;
  }
  const work =
    message.type === "set-default"
      ? chrome.storage.local
          .set({ defaultId: message.defaultId })
          .then(buildMenus)
          .then(stored)
      : loadCollections();
  work.then(respond, (e) =>
    respond({ error: String(e?.message ?? e), ok: false })
  );
  return true;
});
