/**
 * Runs on the board's own site: the door between the extension and the page.
 *
 * The extension can't call into the board (it lives in another world), so a
 * capture is passed on with window.postMessage and the board's answer comes
 * back the same way. The board page does the upload itself, signed in as it
 * already is, so the extension never sees or stores a login.
 */
const TO_PAGE = "board-capture-extension";
const FROM_PAGE = "board-capture-page";
const ANSWER_MS = 90_000;
/** Asks a page should answer fast, or there's no page listening. */
const QUICK = { collections: 8000, ping: 1500 };

chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message?.to !== "board") {
    return;
  }
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const timer = setTimeout(() => {
    window.removeEventListener("message", onAnswer);
    respond({
      error:
        message.type === "ping" || message.type === "capture"
          ? "The board didn't answer. Is a board open in this tab?"
          : "The site didn't answer. Reload a dallaspeters.com tab and sign in.",
      ok: false,
    });
  }, QUICK[message.type] ?? ANSWER_MS);
  function onAnswer(event) {
    if (
      event.source !== window ||
      event.data?.source !== FROM_PAGE ||
      event.data.id !== id
    ) {
      return;
    }
    clearTimeout(timer);
    window.removeEventListener("message", onAnswer);
    respond(event.data);
  }
  window.addEventListener("message", onAnswer);
  window.postMessage({ ...message, id, source: TO_PAGE }, location.origin);
  // Answered later, from onAnswer or the timer.
  return true;
});
