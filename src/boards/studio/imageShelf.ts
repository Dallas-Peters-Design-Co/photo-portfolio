import { createContext, useContext, useEffect, useState } from "react";
import type { BoardItem } from "../../types";

/**
 * The pictures any image picker in the Studio offers besides an upload: what
 * was just generated (in the frame editor or by a node), and every picture on
 * the board. Generated ones are remembered in this browser, newest first, so a
 * picture made a minute ago is there even after the panel that made it closed.
 */

const KEY = "studio:made-images";
const EVENT = "studio:made-images";
const KEEP = 24;
const VIDEO = /\.(mp4|webm|mov)(\?|$)/i;

const readMade = (): string[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown;
    return Array.isArray(raw)
      ? raw.filter((u): u is string => typeof u === "string")
      : [];
  } catch {
    return [];
  }
};

/** Records a picture as just made, so the Studio's pickers offer it first. */
export const rememberMade = (url: string): void => {
  const next = [url, ...readMade().filter((u) => u !== url)].slice(0, KEEP);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Remembering is a convenience; the board still lists it.
  }
  window.dispatchEvent(new Event(EVENT));
};

/** Every picture on the board: placed images and what nodes have made. */
export const boardImages = (items: readonly BoardItem[]): string[] => {
  const urls: string[] = [];
  for (const item of [...items].reverse()) {
    if (item.imageUrl) {
      urls.push(item.imageUrl);
    }
    for (const v of item.result?.variations ?? []) {
      if (v.url) {
        urls.push(v.url);
      }
    }
  }
  return urls;
};

/** The board's pictures, for pickers rendered far below the board editor. */
export const BoardImagesContext = createContext<readonly string[]>([]);

/** Made pictures first, then the board's, each once, no video. */
export const useImageShelf = (): string[] => {
  const board = useContext(BoardImagesContext);
  const [made, setMade] = useState(readMade);
  useEffect(() => {
    const sync = () => setMade(readMade());
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  return [...new Set([...made, ...board])].filter((u) => !VIDEO.test(u));
};
