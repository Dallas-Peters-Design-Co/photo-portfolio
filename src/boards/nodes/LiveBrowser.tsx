import { HugeiconsIcon } from "@hugeicons/react";
import ArrowLeft01Icon from "@hugeicons-pro/core-stroke-standard/ArrowLeft01Icon";
import ArrowRight01Icon from "@hugeicons-pro/core-stroke-standard/ArrowRight01Icon";
import Camera01Icon from "@hugeicons-pro/core-stroke-standard/Camera01Icon";
import RefreshIcon from "@hugeicons-pro/core-stroke-standard/RefreshIcon";
import {
  createElement,
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  BrowserNodeConfig,
  BrowserViewport,
} from "../../../config/nodes/browser.js";
import { portfolioService } from "../../services/portfolioService";

/**
 * The Browser node's page in the desktop app: a real browser in the node.
 *
 * On the web each click is a round trip to a browser on the server, seconds
 * at a time. The desktop app can embed one (a <webview>, see
 * electron/liveBrowser.mjs), so here the page simply works: it loads at full
 * speed, scrolls, takes typing, and stays signed in between sessions in its
 * own storage. Sign in on the page itself; no login is saved in the node.
 *
 * Screenshot captures the whole page, uploads it, and the node becomes that
 * picture, exactly as it does on the web.
 */

/** Must match electron/liveBrowser.mjs: anything else is refused. */
const PARTITION = "persist:review-browser";
const PHONE_WIDTH = 390;

/** The parts of Electron's <webview> this uses. */
interface Webview extends HTMLElement {
  canGoBack: () => boolean;
  canGoForward: () => boolean;
  getTitle: () => string;
  getURL: () => string;
  getWebContentsId: () => number;
  goBack: () => void;
  goForward: () => void;
  loadURL: (url: string) => Promise<void>;
  reload: () => void;
}

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** What was typed, as an address: https unless it says otherwise. */
export const addressOf = (typed: string): string => {
  const text = typed.trim();
  if (!text) {
    return "";
  }
  return SCHEME.test(text) ? text : `https://${text}`;
};

const jpegFile = (base64: string, name: string): File => {
  const bytes = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));
  return new File([bytes], name, { type: "image/jpeg" });
};

/** True in a desktop build that can embed and screenshot a live page. */
export const canBrowseLive = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.photosDesktop?.captureWebview === "function";

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

export function LiveBrowser({
  cfg,
  onCaptured,
  update,
}: {
  cfg: BrowserNodeConfig;
  onCaptured: () => void;
  update: (patch: Record<string, unknown>) => void;
}) {
  const view = useRef<Webview | null>(null);
  // Where the page starts: fixed for the life of this view, so React never
  // resets `src` (and reloads the page) as the address changes under it.
  const [start] = useState(() => addressOf(cfg.pageUrl || cfg.url));
  const [address, setAddress] = useState(start);
  const [nav, setNav] = useState({ back: false, forward: false });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(update);
  latest.current = update;
  const startUrl = useRef(cfg.url);
  startUrl.current = cfg.url;

  // What the webview was opened on; empty until an address is entered.
  const [src, setSrc] = useState(start);
  // The webview doesn't exist until then: its events are wired when it does.
  const hasView = src !== "";
  // biome-ignore lint/correctness/useExhaustiveDependencies: wired once per webview
  useEffect(() => {
    const el = view.current;
    if (!el) {
      return;
    }
    const moved = () => {
      const url = el.getURL();
      setAddress(url);
      setNav({ back: el.canGoBack(), forward: el.canGoForward() });
      latest.current({
        pageUrl: url,
        title: el.getTitle(),
        url: startUrl.current || url,
      });
    };
    const started = () => setLoading(true);
    const stopped = () => {
      setLoading(false);
      moved();
    };
    const failed = (e: Event) => {
      const { errorCode, errorDescription, isMainFrame } = e as Event & {
        errorCode?: number;
        errorDescription?: string;
        isMainFrame?: boolean;
      };
      // -3 is a navigation that was replaced by another: not a failure.
      if (isMainFrame && errorCode !== -3) {
        setError(errorDescription || "That page didn't load.");
      }
    };
    el.addEventListener("did-start-loading", started);
    el.addEventListener("did-stop-loading", stopped);
    el.addEventListener("did-navigate-in-page", moved);
    el.addEventListener("did-fail-load", failed);
    return () => {
      el.removeEventListener("did-start-loading", started);
      el.removeEventListener("did-stop-loading", stopped);
      el.removeEventListener("did-navigate-in-page", moved);
      el.removeEventListener("did-fail-load", failed);
    };
  }, [hasView]);

  const open = (e: FormEvent) => {
    e.preventDefault();
    const url = addressOf(address);
    if (!url) {
      return;
    }
    setError(null);
    if (view.current && src) {
      view.current.loadURL(url).catch(() => undefined);
    } else {
      setSrc(url);
    }
  };

  const screenshot = async () => {
    const el = view.current;
    const shoot = window.photosDesktop?.captureWebview;
    if (!(el && shoot)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const shot = await shoot(el.getWebContentsId());
      const { url } = await portfolioService.uploadImageFile(
        jpegFile(shot.data, "screenshot.jpg"),
        undefined,
        "boards/uploads"
      );
      latest.current({
        captureHeight: shot.height,
        captureUrl: url,
        captureWidth: shot.width,
        pageUrl: shot.url,
        title: shot.title,
        url: startUrl.current || shot.url,
      });
      onCaptured();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't take the screenshot");
    } finally {
      setBusy(false);
    }
  };

  const phone = cfg.viewport === "mobile";
  return (
    <>
      <div className="browser-node__bar">
        <button
          aria-label="Back"
          className="browser-node__icon"
          disabled={!nav.back}
          onClick={() => view.current?.goBack()}
          onPointerDown={stop}
          type="button"
        >
          <HugeiconsIcon aria-hidden icon={ArrowLeft01Icon} size={14} />
        </button>
        <button
          aria-label="Forward"
          className="browser-node__icon"
          disabled={!nav.forward}
          onClick={() => view.current?.goForward()}
          onPointerDown={stop}
          type="button"
        >
          <HugeiconsIcon aria-hidden icon={ArrowRight01Icon} size={14} />
        </button>
        <button
          aria-label="Reload"
          className="browser-node__icon"
          data-on={loading ? "" : undefined}
          disabled={!src}
          onClick={() => view.current?.reload()}
          onPointerDown={stop}
          type="button"
        >
          <HugeiconsIcon aria-hidden icon={RefreshIcon} size={14} />
        </button>
        <form className="browser-node__address" onSubmit={open}>
          <input
            aria-label="Address"
            className="browser-node__url"
            onChange={(e) => setAddress(e.target.value)}
            onPointerDown={stop}
            placeholder="https://"
            value={address}
          />
        </form>
        <select
          aria-label="Width"
          className="browser-node__viewport"
          onChange={(e) =>
            latest.current({ viewport: e.target.value as BrowserViewport })
          }
          onPointerDown={stop}
          value={cfg.viewport}
        >
          <option value="desktop">Desktop</option>
          <option value="mobile">Phone</option>
        </select>
        <button
          className="browser-node__button browser-node__button--primary"
          disabled={busy || !src}
          onClick={() => {
            screenshot().catch(() => undefined);
          }}
          onPointerDown={stop}
          type="button"
        >
          <HugeiconsIcon aria-hidden icon={Camera01Icon} size={14} />
          {busy ? "Saving…" : "Screenshot"}
        </button>
      </div>
      <div
        className="browser-node__view browser-node__view--live"
        onPointerDown={stop}
      >
        {src ? (
          createElement("webview", {
            className: "browser-node__live",
            partition: PARTITION,
            ref: view,
            src,
            style: phone ? { flex: "none", width: PHONE_WIDTH } : undefined,
          })
        ) : (
          <div className="browser-node__empty">
            <p>Enter an address above. Sign in on the page itself.</p>
          </div>
        )}
      </div>
      {error ? (
        <p className="browser-node__error" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
