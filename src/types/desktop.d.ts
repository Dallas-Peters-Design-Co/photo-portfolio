/**
 * What the desktop shell exposes to the page — see electron/preload.cjs.
 *
 * Present only when the site runs inside the Photos desktop app. Everywhere
 * else `window.photosDesktop` is undefined and the page behaves as a website.
 */
/** A full-page screenshot from the desktop app's embedded browser. */
interface DesktopCapture {
  /** Base64 JPEG. */
  data: string;
  height: number;
  title: string;
  url: string;
  width: number;
}

interface PhotosDesktop {
  /**
   * Screenshots one of the page's own <webview>s by its web contents id.
   * Present from the build that added the live Browser node; its presence
   * is how the node knows it can browse live.
   */
  captureWebview?: (id: number) => Promise<DesktopCapture>;
  /** Drops the stored Google tokens so the next request asks for consent. */
  forgetGoogleToken: () => Promise<void>;
  /**
   * A native notification; clicking it focuses the window and calls the
   * `onNotificationClick` handler with `url`. Missing from older builds.
   */
  notify?: (notice: {
    body?: string;
    title: string;
    url?: string;
  }) => Promise<void>;
  /** Subscribes to notification clicks; returns the unsubscribe. */
  onNotificationClick?: (handler: (url: string) => void) => () => void;
  /**
   * An access token for `scope`, obtained through the system browser rather
   * than a popup, because Google refuses to sign in inside an embedded window.
   */
  requestGoogleToken: (
    scope: string
  ) => Promise<{ access_token: string; expires_in: number }>;
  /** The unread count on the dock icon; 0 clears it. */
  setBadgeCount?: (count: number) => Promise<void>;
}

interface Window {
  photosDesktop?: PhotosDesktop;
}
