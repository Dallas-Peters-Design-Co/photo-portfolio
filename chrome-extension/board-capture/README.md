# Board Capture (Chrome extension)

Screenshots the page you're on and puts it on your open board as a Browser
node, ready for markup and numbered notes.

## Install

1. Chrome → `chrome://extensions` → turn on **Developer mode**.
2. **Load unpacked** → choose this folder (`chrome-extension/board-capture`).
3. Reload any board tab that was already open, once.

## Use

1. Open the board in a Chrome tab (dallaspeters.com/admin → the board).
2. Go to the page you want, signed in as you need to be.
3. Click the extension → **Whole page** (or **What's on screen**).
   Shortcut: Alt+Shift+S captures the whole page to the first open board.

The picture lands near the middle of what the board is showing.

## How it works

- The capture uses Chrome's DevTools protocol, so Chrome shows a "debugging
  this browser" bar for a moment. That's what allows a page taller than the
  window in one picture (up to 12,000 px).
- The picture is handed to the board tab, which uploads it signed in as it
  already is. The extension never sees or stores a login, and talks only to
  the board's own site.
- The board must be open in Chrome. The desktop app can't hear a Chrome
  extension; it has its own live Browser node instead.
