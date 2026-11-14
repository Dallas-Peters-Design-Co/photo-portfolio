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

chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message?.to !== "board") {
    return;
  }
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const timer = setTimeout(() => {
    window.removeEventListener("message", onAnswer);
    respond({ ok: false, error: "The board didn't answer. Is a board open in this tab?" });
  }, message.type === "ping" ? 1500 : ANSWER_MS);
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
