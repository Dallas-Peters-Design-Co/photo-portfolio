import { HugeiconsIcon } from "@hugeicons/react";
import ArrowDown01Icon from "@hugeicons-pro/core-stroke-standard/ArrowDown01Icon";
import GridViewIcon from "@hugeicons-pro/core-stroke-standard/GridViewIcon";
import Tick02Icon from "@hugeicons-pro/core-stroke-standard/Tick02Icon";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { BoardSwitcher } from "./BoardSwitcher";
import "./boardEditorChrome.css";

/**
 * The board's name, and whether its work is safe.
 *
 * Lifted out of BoardEditor.tsx, which had no room left to grow. Small, but the
 * save indicator is the honest half of saving on a debounce: there is no save
 * button to press, so this is the only thing telling anyone whether what they
 * just dragged has reached the server.
 *
 * The name opens the board switcher: jump to any other board (⌘K too), with
 * renaming this one and starting a new one at its foot.
 */
export interface BoardStatusBarProps {
  isDirty: boolean;
  isSaving: boolean;
  /** Omitted for a read-only view, which then renders a plain heading. */
  onRename?: () => void;
  /** Leaves for another board's address, saving this one first. */
  onSwitch?: (to: string) => void;
  title: string;
}

export function BoardStatusBar({
  isDirty,
  isSaving,
  onRename,
  onSwitch,
  title,
}: BoardStatusBarProps) {
  const { boardId = "" } = useParams<{ boardId: string }>();
  const [switching, setSwitching] = useState(false);

  // ⌘K / Ctrl+K opens it from anywhere on the board.
  useEffect(() => {
    if (!onSwitch) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSwitching((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSwitch]);

  return (
    <div className="board-panel board-panel--top board-status">
      <HugeiconsIcon
        aria-hidden
        className="board-status__icon"
        icon={GridViewIcon}
        size={14}
      />
      <h2 className="board-status__title">
        {onSwitch ? (
          <button
            aria-expanded={switching}
            className="board-status__rename board-status__switch"
            onClick={() => setSwitching((v) => !v)}
            title="Jump to another board (⌘K)"
            type="button"
          >
            {title}
            <HugeiconsIcon aria-hidden icon={ArrowDown01Icon} size={12} />
          </button>
        ) : (
          title
        )}
      </h2>
      <p className="board-status__state">
        {isSaving ? "Saving…" : null}
        {!isSaving && isDirty ? "Unsaved changes" : null}
        {isSaving || isDirty ? null : (
          <span className="board-status__detail">
            <HugeiconsIcon aria-hidden icon={Tick02Icon} size={11} />
            Saved
          </span>
        )}
      </p>
      {switching && onSwitch ? (
        <BoardSwitcher
          currentId={boardId}
          onClose={() => setSwitching(false)}
          onGo={onSwitch}
          onRename={onRename}
        />
      ) : null}
    </div>
  );
}
