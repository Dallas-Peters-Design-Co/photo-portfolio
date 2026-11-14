/**
 * Board Capture: screenshots the active tab and hands the picture to a board
 * open in another tab (see bridge.js for how it gets in).
 *
 * The whole page is captured through the DevTools protocol, which is why
 * Chrome shows its "is debugging this browser" bar for a moment: it's the
 * only way to get a page taller than the window in one picture. Signed-in
 * pages work because it's your own tab, as you see it.
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

const send = (target, method, params) =>
  chrome.debugger.sendCommand(target, method, params);

/** A JPEG of the tab: the whole page, or just what's in view. */
const capture = async (tab, whole) => {
  const target = { tabId: tab.id };
  await chrome.debugger.attach(target, "1.3");
  try {
    const metrics = await send(target, "Page.getLayoutMetrics");
    const box = whole ? metrics.cssContentSize : metrics.cssVisualViewport;
    const width = Math.max(1, Math.ceil(box.width ?? box.clientWidth));
    const height = Math.min(
      MAX_HEIGHT,
      Math.max(1, Math.ceil(box.height ?? box.clientHeight))
    );
    const top = whole ? 0 : (metrics.cssVisualViewport.pageY ?? 0);
    // Twice the size for a sharp picture, when the page is short enough.
    const scale = Math.max(width, height) * 2 <= MAX_PIXELS ? 2 : 1;
    const { data } = await send(target, "Page.captureScreenshot", {
      captureBeyondViewport: true,
      clip: { height, scale, width, x: 0, y: top },
      format: "jpeg",
      quality: 88,
    });
    return { data, height: height * scale, width: width * scale };
  } finally {
    await chrome.debugger.detach(target).catch(() => undefined);
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
    shot = await capture(tab, whole);
  } catch (e) {
    return { ok: false, error: `Couldn't capture this page: ${e?.message ?? e}` };
  }
  const answer = await ask(board.tabId, {
    ...shot,
    title: tab.title ?? "",
    type: "capture",
    url: tab.url,
  });
  return answer?.ok ? { ok: true, board: board.name } : answer;
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
