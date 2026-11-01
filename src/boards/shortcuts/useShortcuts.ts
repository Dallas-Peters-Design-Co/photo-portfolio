import { useEffect, useRef } from "react";
import { type Command, commandFor, isTyping } from "./keys";

/**
 * Runs commands from the keyboard.
 *
 * Caught on the way down (capture) so a surface drawn over the board, like
 * the frame editor, gets its keys before the board does, and a key it uses is
 * not seen by the board at all. Keys typed into a field are left alone, and
 * so is everything while `paused` (a dialog of its own is open).
 */
export const useShortcuts = (
  commands: Command[],
  {
    onEscape,
    onPausedEscape,
    paused = false,
  }: {
    onEscape?: () => void;
    /** Esc while paused: closing whatever panel paused the shortcuts. */
    onPausedEscape?: () => void;
    paused?: boolean;
  } = {}
) => {
  // The latest list, read when a key arrives, so the listener is added once.
  const latest = useRef({ commands, onEscape, onPausedEscape, paused });
  latest.current = { commands, onEscape, onPausedEscape, paused };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const now = latest.current;
      if (now.paused && e.key === "Escape" && now.onPausedEscape) {
        e.preventDefault();
        e.stopImmediatePropagation();
        now.onPausedEscape();
        return;
      }
      if (now.paused || isTyping(e.target)) {
        return;
      }
      if (e.key === "Escape" && now.onEscape) {
        e.preventDefault();
        e.stopImmediatePropagation();
        now.onEscape();
        return;
      }
      const command = commandFor(e, now.commands);
      if (command) {
        e.preventDefault();
        e.stopImmediatePropagation();
        command.run();
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKey, { capture: true });
  }, []);
};
