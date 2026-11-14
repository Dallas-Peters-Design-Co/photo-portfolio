import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { portfolioService } from "../../../services/portfolioService";

/**
 * Screenshots sent by the Board Capture Chrome extension
 * (chrome-extension/board-capture), landing on the open board.
 *
 * The extension captures a page in another tab and passes the picture in
 * through its content script as a window message. This side does the rest as
 * the signed-in editor it already is: uploads the picture and places a
 * Browser node holding it, ready for markup and notes, exactly as a
 * screenshot taken in the node itself would be. The extension never has a
 * login, and a capture arrives through the board's own change path, so it's
 * saved, undoable and never overwritten by an autosave.
 *
 * Only messages from this window, at this origin, with the extension's tag
 * are read; each is answered so the extension can say what happened.
 */

const FROM_EXTENSION = "board-capture-extension";
const TO_EXTENSION = "board-capture-page";

/** A captured page, as the Browser node keeps it (config/nodes/browser.ts). */
export interface CapturedPage {
  captureHeight: number;
  captureUrl: string;
  captureWidth: number;
  pageUrl: string;
  title: string;
  url: string;
}

interface Ask {
  data?: unknown;
  height?: unknown;
  id?: unknown;
  source?: unknown;
  title?: unknown;
  type?: unknown;
  url?: unknown;
  width?: unknown;
}

const jpegFile = (base64: string): File => {
  const bytes = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));
  return new File([bytes], "screenshot.jpg", { type: "image/jpeg" });
};

const side = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : 0;

/** The picture uploaded, as the node's config; throws if it isn't a capture. */
export const captureFrom = async (ask: Ask): Promise<CapturedPage> => {
  const width = side(ask.width);
  const height = side(ask.height);
  if (!(typeof ask.data === "string" && ask.data && width && height)) {
    throw new Error("That wasn't a screenshot.");
  }
  const { url: captureUrl } = await portfolioService.uploadImageFile(
    jpegFile(ask.data),
    undefined,
    "boards/uploads"
  );
  const pageUrl = typeof ask.url === "string" ? ask.url.slice(0, 2000) : "";
  return {
    captureHeight: height,
    captureUrl,
    captureWidth: width,
    pageUrl,
    title: typeof ask.title === "string" ? ask.title.slice(0, 200) : "",
    url: pageUrl,
  };
};

export const useExtensionCaptures = (
  /** Places a Browser node holding the captured page. */
  place: (page: CapturedPage) => void
): void => {
  const latest = useRef(place);
  latest.current = place;

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const ask = event.data as Ask | null;
      if (
        event.source !== window ||
        event.origin !== window.location.origin ||
        ask?.source !== FROM_EXTENSION
      ) {
        return;
      }
      const answer = (more: Record<string, unknown>) =>
        window.postMessage(
          { id: ask.id, source: TO_EXTENSION, ...more },
          window.location.origin
        );
      if (ask.type === "ping") {
        // The tab's title names the board, for the extension's list.
        answer({ board: document.title, ok: true });
        return;
      }
      if (ask.type !== "capture") {
        return;
      }
      captureFrom(ask).then(
        (page) => {
          latest.current(page);
          toast.success(`Screenshot added: ${page.title || page.pageUrl}`);
          answer({ ok: true });
        },
        (e: unknown) =>
          answer({
            error: e instanceof Error ? e.message : "Couldn't add it",
            ok: false,
          })
      );
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
};
