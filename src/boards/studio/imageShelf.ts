import { createContext, useContext, useEffect, useState } from "react";
import type { BoardItem } from "../../types";

/**
 * The pictures any image picker in the Studio offers besides an upload: what
 * was just generated (in the frame editor or by a node), and every picture on
 * the board. Generated ones are remembered in this browser, newest first, so a
 * picture made a minute ago is there even after the panel that made it closed.
 *
 * A picture can be taken off the shelf (the x on it). It's forgotten as
 * "made" and hidden from the pickers in this browser; nothing is deleted,
 * and a picture on the board stays on the board.
 */

const KEY = "studio:made-images";
const EVENT = "studio:made-images";
const KEEP = 24;
const HIDDEN_KEY = "studio:hidden-images";
/** Enough to hide a long history without the list growing for ever. */
const HIDDEN_KEEP = 400;
const VIDEO = /\.(mp4|webm|mov)(\?|$)/i;

const readList = (key: string): string[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown;
    return Array.isArray(raw)
      ? raw.filter((u): u is string => typeof u === "string")
      : [];
  } catch {
    return [];
  }
};

const readMade = () => readList(KEY);
const readHidden = () => readList(HIDDEN_KEY);

const writeList = (key: string, list: string[]) => {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // Remembering is a convenience.
  }
  window.dispatchEvent(new Event(EVENT));
};

/** Takes a picture off the shelf, in this browser. Nothing is deleted. */
export const hideFromShelf = (url: string): void => {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify(readMade().filter((u) => u !== url))
    );
  } catch {
    // As below.
  }
  writeList(
    HIDDEN_KEY,
    [url, ...readHidden().filter((u) => u !== url)].slice(0, HIDDEN_KEEP)
  );
};

/** Puts every hidden picture back on the shelf. */
export const restoreShelf = (): void => writeList(HIDDEN_KEY, []);

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

interface Shelf {
  /** How many pictures have been taken off it. */
  hidden: number;
  /** Made pictures first, then the board's, each once, no video. */
  urls: string[];
}

export const useShelf = (): Shelf => {
  const board = useContext(BoardImagesContext);
  const [lists, setLists] = useState(() => ({
    hidden: readHidden(),
    made: readMade(),
  }));
  useEffect(() => {
    const sync = () => setLists({ hidden: readHidden(), made: readMade() });
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  const off = new Set(lists.hidden);
  const all = [...new Set([...lists.made, ...board])].filter(
    (u) => !VIDEO.test(u)
  );
  return {
    hidden: all.filter((u) => off.has(u)).length,
    urls: all.filter((u) => !off.has(u)),
  };
};

/** The shelf's pictures alone. */
export const useImageShelf = (): string[] => useShelf().urls;
