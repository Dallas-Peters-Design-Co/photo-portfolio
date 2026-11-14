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
    left: window.scrollX,
    top: window.scrollY,
    // The photograph is of the whole window, scrollbar included.
    innerW: window.innerWidth,
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
    for (; done < height; ) {
      const wanted = first + done;
      // The page may not scroll that far (the last screen): ask where it got.
      // eslint-disable-next-line no-await-in-loop
      const at = await inPage(
        tab.id,
        (y, hide) => {
          if (hide) {
            for (const el of document.querySelectorAll("body *")) {
              const position = getComputedStyle(el).position;
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
        `scrolling: ${scrolling?.message ?? scrolling} · screen: ${screen?.message ?? screen}`
      );
    }
  }
};

const ask = (tabId, message) =>
  chrome.tabs
    .sendMessage(tabId, { ...message, to: "board" })
    .catch(() => ({ ok: false, error: "Reload the board tab once, so it can hear the extension." }));

/** Tabs with a board open and listening, each with the board's name. */
const openBoards = async () => {
  const tabs = await chrome.tabs.query({ url: BOARD_HOSTS });
  const answers = await Promise.all(
    tabs.map(async (tab) => ({ answer: await ask(tab.id, { type: "ping" }), tab }))
  );
  return answers
    .filter(({ answer }) => answer?.ok)
    .map(({ answer, tab }) => ({ name: answer.board || tab.title, tabId: tab.id }));
};

const captureToBoard = async ({ boardTabId, whole }) => {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id || !/^https?:/.test(tab.url ?? "")) {
    return { ok: false, error: "This page can't be captured." };
  }
  const boards = await openBoards();
  const board = boards.find((b) => b.tabId === boardTabId) ?? boards[0];
  if (!board) {
    return { ok: false, error: "Open a board in a tab first." };
  }
  if (board.tabId === tab.id) {
    return { ok: false, error: "Switch to the page you want to capture." };
  }
  let shot;
  try {
    shot = await shoot(tab, whole);
  } catch (e) {
    return { ok: false, error: `Couldn't capture this page: ${e?.message ?? e}` };
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
  const work = message.type === "boards" ? openBoards() : captureToBoard(message);
  work.then(respond, (e) => respond({ ok: false, error: String(e?.message ?? e) }));
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
