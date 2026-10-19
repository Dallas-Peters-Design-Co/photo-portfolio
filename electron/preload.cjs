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
