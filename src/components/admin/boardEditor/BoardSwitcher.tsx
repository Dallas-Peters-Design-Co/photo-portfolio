import { HugeiconsIcon } from "@hugeicons/react";
import PencilEdit01Icon from "@hugeicons-pro/core-stroke-standard/PencilEdit01Icon";
import PlusSignIcon from "@hugeicons-pro/core-stroke-standard/PlusSignIcon";
import Search01Icon from "@hugeicons-pro/core-stroke-standard/Search01Icon";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { boardsApi } from "../../../services/portfolioService";
import type { Board } from "../../../types";
import "../../../boards/panels/CollectionPanel.css";
import "./boardSwitcher.css";

/**
 * Jumping to another board from this one's name: every board, most recently
 * worked on first, filtered as you type. Arrow keys and Enter pick; Escape
 * or a click outside closes. Renaming this board, and starting a new one,
 * sit at the foot.
 *
 * Leaving goes through `onGo`, which saves this board first.
 */
interface BoardSwitcherProps {
  currentId: string;
  onClose: () => void;
  /** Goes to a board's address, after saving this one. */
  onGo: (to: string) => void;
  onRename?: () => void;
}

const matches = (board: Board, query: string): boolean =>
  board.title.toLowerCase().includes(query.trim().toLowerCase());

export function BoardSwitcher({
  currentId,
  onClose,
  onGo,
  onRename,
}: BoardSwitcherProps) {
  const [boards, setBoards] = useState<Board[] | null>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    boardsApi
      .list()
      .then((all) => {
        if (live) {
          setBoards(
            [...all].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
          );
        }
      })
      .catch(() => live && setBoards([]));
    return () => {
      live = false;
    };
  }, []);

  // A click anywhere else closes it.
  useEffect(() => {
    const away = (e: PointerEvent) => {
      const at = e.target as Element;
      // The name toggles it itself; closing here too would reopen it.
      if (
        !(panel.current?.contains(at) || at.closest?.(".board-status__switch"))
      ) {
        onClose();
      }
    };
    window.addEventListener("pointerdown", away);
    return () => window.removeEventListener("pointerdown", away);
  }, [onClose]);

  const shown = useMemo(
    () =>
      (boards ?? []).filter(
        (board) => board.id !== currentId && matches(board, query)
      ),
    [boards, currentId, query]
  );

  const go = (board: Board | undefined) => {
    if (board) {
      onClose();
      onGo(`/admin/boards/${board.id}`);
    }
  };

  const create = async () => {
    const title = query.trim() || "Untitled board";
    try {
      const made = await boardsApi.create(title);
      onClose();
      onGo(`/admin/boards/${made.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create a board");
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(shown.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(shown[active]);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div
      className="board-panel collection-panel board-switcher"
      ref={panel}
      role="dialog"
    >
      <div className="collection-panel__header">
        <HugeiconsIcon
          aria-hidden
          className="collection-panel__icon"
          icon={Search01Icon}
          size={14}
        />
        <input
          aria-label="Find a board"
          // biome-ignore lint/a11y/noAutofocus: it opens to be typed into
          autoFocus
          className="board-switcher__field"
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKey}
          placeholder="Jump to a board…"
          value={query}
        />
      </div>

      <div className="collection-panel__list">
        {boards === null ? (
          <p className="collection-panel__message">Loading…</p>
        ) : null}
        {boards && shown.length === 0 ? (
          <p className="collection-panel__message">No other boards match.</p>
        ) : null}
        {shown.map((board, i) => (
          <button
            className="collection-panel__option"
            data-active={i === active ? "" : undefined}
            key={board.id}
            onClick={() => go(board)}
            onMouseEnter={() => setActive(i)}
            type="button"
          >
            <span className="collection-panel__name">{board.title}</span>
            <span className="collection-panel__count">
              {board.itemCount ?? 0}
            </span>
          </button>
        ))}
      </div>

      <div className="board-switcher__foot">
        {onRename ? (
          <button
            className="collection-panel__option"
            onClick={() => {
              onClose();
              onRename();
            }}
            type="button"
          >
            <span className="board-switcher__action">
              <HugeiconsIcon aria-hidden icon={PencilEdit01Icon} size={12} />
              Rename this board
            </span>
          </button>
        ) : null}
        <button
          className="collection-panel__option"
          onClick={() => void create()}
          type="button"
        >
          <span className="board-switcher__action">
            <HugeiconsIcon aria-hidden icon={PlusSignIcon} size={12} />
            New board{query.trim() ? ` “${query.trim()}”` : ""}
          </span>
        </button>
      </div>
    </div>
  );
}
