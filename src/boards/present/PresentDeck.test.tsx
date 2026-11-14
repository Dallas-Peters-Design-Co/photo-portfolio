import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PresentDeck } from "./PresentDeck";
import type { Slide } from "./slides";

/**
 * Escape in present mode. A browser takes it to leave full screen and never
 * passes it on; the desktop app passes it to the page, which used to close
 * the deck and leave the window stuck full screen.
 */

let host: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  vi.restoreAllMocks();
  Reflect.deleteProperty(document, "fullscreenElement");
});

const slides = [{ kind: "title", title: "Deck" }] as unknown as Slide[];

const mount = (onExit: () => void) => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root?.render(<PresentDeck onExit={onExit} slides={slides} />));
};

const pressEscape = () =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  });

describe("PresentDeck's Escape", () => {
  it("leaves full screen first and keeps the deck open", () => {
    const exit = vi.fn();
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => document.documentElement,
    });
    const leave = vi
      .spyOn(document, "exitFullscreen")
      .mockResolvedValue(undefined);
    mount(exit);
    pressEscape();
    expect(leave).toHaveBeenCalledOnce();
    expect(exit).not.toHaveBeenCalled();
  });

  it("leaves the deck when it isn't full screen", () => {
    const exit = vi.fn();
    mount(exit);
    pressEscape();
    expect(exit).toHaveBeenCalledOnce();
  });
});
