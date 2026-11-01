import { describe, expect, it } from "vitest";
import { formatKeys, matches } from "./keys";

const key = (k: string, init: KeyboardEventInit = {}) =>
  new KeyboardEvent("keydown", { key: k, ...init });

describe("shortcut keys", () => {
  it("matches letters, modifiers and Shift exactly", () => {
    expect(matches(key("d", { metaKey: true }), "mod+d")).toBe(true);
    expect(matches(key("d", { ctrlKey: true }), "mod+d")).toBe(true);
    expect(matches(key("d"), "mod+d")).toBe(false);
    expect(matches(key("T", { shiftKey: true }), "shift+t")).toBe(true);
    expect(matches(key("T", { shiftKey: true }), "t")).toBe(false);
    expect(matches(key("Tab", { shiftKey: true }), "Tab")).toBe(false);
    expect(matches(key("Tab", { shiftKey: true }), "shift+Tab")).toBe(true);
  });

  it("reads ⌥ letters by the key, not the symbol a Mac types", () => {
    expect(matches(key("å", { altKey: true, code: "KeyA" }), "alt+a")).toBe(
      true
    );
    expect(matches(key("å", { altKey: true, code: "KeyA" }), "a")).toBe(false);
  });

  it("takes shifted characters as typed", () => {
    expect(matches(key("?", { shiftKey: true }), "?")).toBe(true);
    expect(
      matches(key("}", { metaKey: true, shiftKey: true }), "shift+mod+]")
    ).toBe(true);
    expect(
      matches(key(">", { metaKey: true, shiftKey: true }), "shift+mod+.")
    ).toBe(true);
  });

  it("shows the Mac glyphs", () => {
    expect(formatKeys("shift+mod+]")).toBe("⇧⌘]");
    expect(formatKeys("alt+ArrowUp")).toBe("⌥↑");
    expect(formatKeys("t")).toBe("T");
  });
});
