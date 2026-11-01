/**
 * Keyboard shortcuts written as text ("mod+d", "shift+mod+]", "alt+ArrowUp",
 * "?"), matched against key events and shown with the Mac's glyphs.
 *
 * `mod` is ⌘ on a Mac and Ctrl elsewhere. A letter matches whatever its case,
 * and Shift must be pressed exactly when the combo names it, so "t" and
 * "shift+t" are two shortcuts. Keys that are themselves shifted characters
 * ("?", "<", ">") ignore Shift, since there's no other way to type them.
 */

export interface Command {
  /** Run unless `enabled` is false. */
  enabled?: boolean;
  group: string;
  id: string;
  /** One or more combos; the first is the one shown. */
  keys?: string[];
  label: string;
  run: () => void;
}

const SHIFTED = new Set(["?", "<", ">", "{", "}", "+", "_", ":", '"', "|"]);

interface Combo {
  alt: boolean;
  key: string;
  mod: boolean;
  shift: boolean;
}

const parse = (combo: string): Combo => {
  const parts = combo.split("+");
  // "mod++" is "mod" and "+".
  const key = combo.endsWith("++") ? "+" : (parts.at(-1) ?? "");
  const mods = new Set(parts.slice(0, -1).map((p) => p.toLowerCase()));
  return {
    alt: mods.has("alt"),
    key,
    mod: mods.has("mod"),
    shift: mods.has("shift"),
  };
};

/** The key a physical key gives without Alt (⌥ turns letters into symbols on a Mac). */
const baseKey = (e: KeyboardEvent): string => {
  if (e.altKey && e.code.startsWith("Key")) {
    return e.code.slice(3).toLowerCase();
  }
  if (e.altKey && e.code.startsWith("Digit")) {
    return e.code.slice(5);
  }
  return e.key;
};

export const matches = (e: KeyboardEvent, combo: string): boolean => {
  const c = parse(combo);
  const mod = e.metaKey || e.ctrlKey;
  if (mod !== c.mod || e.altKey !== c.alt) {
    return false;
  }
  const key = baseKey(e);
  if (SHIFTED.has(c.key)) {
    return key === c.key;
  }
  if (e.shiftKey !== c.shift) {
    return false;
  }
  // ⇧ turns "]" into "}" and "." into ">" on most layouts: match either.
  const shiftedPairs: Record<string, string> = {
    ",": "<",
    ".": ">",
    "[": "{",
    "]": "}",
  };
  return (
    key.toLowerCase() === c.key.toLowerCase() ||
    (c.shift && shiftedPairs[c.key] === key)
  );
};

const GLYPHS: Record<string, string> = {
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
  alt: "⌥",
  Backspace: "⌫",
  Delete: "⌫",
  Enter: "↵",
  Escape: "Esc",
  mod: "⌘",
  shift: "⇧",
  Tab: "⇥",
};

/** "shift+mod+]" as "⇧⌘]". */
export const formatKeys = (combo: string): string => {
  const c = parse(combo);
  const key =
    GLYPHS[c.key] ?? (c.key.length === 1 ? c.key.toUpperCase() : c.key);
  return `${c.alt ? "⌥" : ""}${c.shift ? "⇧" : ""}${c.mod ? "⌘" : ""}${key}`;
};

/** The first enabled command any of whose combos the event matches. */
export const commandFor = (
  e: KeyboardEvent,
  commands: Command[]
): Command | undefined =>
  commands.find(
    (c) => c.enabled !== false && c.keys?.some((k) => matches(e, k))
  );

/** Whether a key press is going into something being typed in. */
export const isTyping = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    (target instanceof HTMLTextAreaElement && !target.readOnly) ||
    target.tagName === "SELECT" ||
    (target instanceof HTMLInputElement &&
      !["button", "checkbox", "color", "radio", "range"].includes(
        target.type
      )));
