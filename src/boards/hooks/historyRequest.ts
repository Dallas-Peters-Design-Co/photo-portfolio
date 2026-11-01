/**
 * Undo and redo from anywhere on the board's screen, and when a key should
 * leave them alone.
 *
 * The history lives with the board document (useBoardWindowEvents). Things
 * drawn over the board, like the creative editor, ask for a step by event
 * rather than having the board's internals threaded through to them.
 */

const EVENT = "board-history";

export const requestHistory = (redo: boolean): void => {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { redo } }));
};

export const onHistoryRequest = (
  handler: (redo: boolean) => void
): (() => void) => {
  const listener = (e: Event) =>
    handler(Boolean((e as CustomEvent<{ redo?: boolean }>).detail?.redo));
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
};

/**
 * Inputs whose own ⌘Z undoes typing. Sliders, colours and boxes have none, and
 * neither, usefully, does a number field: after setting a size or an angle the
 * field keeps focus, and ⌘Z there should undo the change, not a keystroke.
 */
const TEXT_INPUTS = new Set([
  "",
  "email",
  "password",
  "search",
  "tel",
  "text",
  "url",
]);

/**
 * Whether focus is somewhere a person types, so ⌘Z belongs to the field.
 *
 * A slider, colour well or checkbox that still has focus after being used is
 * not: treating every input as typing is what made ⌘Z do nothing in the
 * creative editor right after touching a control.
 */
export const isTextEntry = (el: Element | EventTarget | null): boolean => {
  if (el instanceof HTMLTextAreaElement) {
    return !el.readOnly;
  }
  if (el instanceof HTMLInputElement) {
    return TEXT_INPUTS.has(el.type) && !el.readOnly;
  }
  return el instanceof HTMLElement && el.isContentEditable;
};
