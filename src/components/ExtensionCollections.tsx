import { useEffect } from "react";
import { toast } from "sonner";
import { authStorage } from "../services/portfolioService";

/**
 * The Board Capture extension's way into collections, from any page of the
 * site while signed in (chrome-extension/board-capture: bridge.js carries
 * the messages). It asks for the collections, to fill its right-click menu
 * and popup, and to save an image from another site into one: the site
 * copies the picture into its own store and describes it for search.
 * The extension never holds a login; this page does the work as you.
 *
 * Only messages from this window, at this origin, with the extension's tag
 * are read, and only these two kinds; captures to a board are the board's.
 */

const FROM_EXTENSION = "board-capture-extension";
const TO_EXTENSION = "board-capture-page";
const MAX_TEXT = 200;
const MAX_URL = 2048;

interface Ask {
  alt?: unknown;
  collectionId?: unknown;
  id?: unknown;
  source?: unknown;
  title?: unknown;
  type?: unknown;
  url?: unknown;
}

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim()
    ? value.trim().slice(0, MAX_TEXT)
    : null;

const handle = async (ask: Ask): Promise<Record<string, unknown>> => {
  if (!authStorage.getToken()) {
    return { error: "Sign in to dallaspeters.com in this browser.", ok: false };
  }
  // Loaded when asked: this sits on every page of the public site.
  const { collectionsApi } = await import("../services/libraryService");
  if (ask.type === "collections") {
    const list = await collectionsApi.list();
    return {
      collections: list.map((c) => ({ id: c.id, name: c.name })),
      ok: true,
    };
  }
  const collectionId = text(ask.collectionId);
  const url =
    typeof ask.url === "string" && ask.url.length <= MAX_URL ? ask.url : "";
  if (!(collectionId && url)) {
    return { error: "Pick a collection and an image.", ok: false };
  }
  await collectionsApi.addItem(collectionId, {
    alt: text(ask.alt),
    copy: true,
    kind: "image",
    title: text(ask.title),
    url,
  });
  return { ok: true };
};

export function ExtensionCollections() {
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const ask = event.data as Ask | null;
      if (
        event.source !== window ||
        event.origin !== window.location.origin ||
        ask?.source !== FROM_EXTENSION ||
        !(ask.type === "collections" || ask.type === "save-image")
      ) {
        return;
      }
      const answer = (more: Record<string, unknown>) =>
        window.postMessage(
          { id: ask.id, source: TO_EXTENSION, ...more },
          window.location.origin
        );
      handle(ask).then(
        (result) => {
          if (ask.type === "save-image" && result.ok) {
            toast.success("Saved to the collection");
          }
          answer(result);
        },
        (err: unknown) =>
          answer({
            error: err instanceof Error ? err.message : "That didn't save.",
            ok: false,
          })
      );
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
  return null;
}
