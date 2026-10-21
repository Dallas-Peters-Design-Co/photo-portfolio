"use strict";
/**
 * The one door between the site and the desktop shell.
 *
 * Runs in the page's process with the sandbox on, so it can reach only what
 * `contextBridge` exposes here. The page checks for `window.photosDesktop` to
 * know it is inside the app and to route Google sign-in through the system
 * browser instead of a popup Google would refuse.
 *
 * CommonJS on purpose: a sandboxed preload cannot be an ES module.
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("photosDesktop", {
  /** Drops the stored Google tokens so the next request asks for consent. */
  forgetGoogleToken: () => ipcRenderer.invoke("google:forget"),
  /**
   * A native notification. Web Push has no push service inside Electron, so
   * the admin's bell shows new activity through this instead.
   */
  notify: (notice) => ipcRenderer.invoke("notify:show", notice),
  /** Runs `handler(url)` when a notification is clicked. */
  onNotificationClick: (handler) => {
    const listener = (_event, url) => handler(url);
    ipcRenderer.on("notify:open", listener);
    return () => ipcRenderer.removeListener("notify:open", listener);
  },
  /**
   * An access token for `scope`, obtained through the system browser.
   * Resolves to `{ access_token, expires_in }` like Google Identity Services.
   */
  requestGoogleToken: (scope) => ipcRenderer.invoke("google:token", scope),
  /** The unread count on the dock icon; 0 clears it. */
  setBadgeCount: (count) => ipcRenderer.invoke("notify:badge", count),
});

/**
 * A double-click along the top edge, reported as a title-bar double-click.
 *
 * The window has no title bar (`hiddenInset`), so the top of the page is where
 * one would be. A drag strip there would make it a title bar, but a drag strip
 * swallows every click under it — the board's rail and panels sit at the very
 * top — so this listens instead: a double-click in the top band, on nothing
 * that is itself clickable, is passed to the main process, which zooms or
 * minimises as System Settings says. Nothing is drawn.
 */
const TITLE_BAND_PX = 28;
const INTERACTIVE =
  'a, button, input, textarea, select, label, summary, [role="button"], [role="menuitem"], [role="tab"], [contenteditable=""], [contenteditable="true"]';

window.addEventListener(
  "dblclick",
  (event) => {
    if (event.clientY > TITLE_BAND_PX || event.button !== 0) {
      return;
    }
    const { target } = event;
    if (target instanceof Element && target.closest(INTERACTIVE)) {
      return;
    }
    ipcRenderer.send("window:title-double-click");
  },
  true
);
