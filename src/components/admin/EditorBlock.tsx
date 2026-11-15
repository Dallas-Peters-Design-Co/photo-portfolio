import { ChevronRight } from "lucide-react";
import { type ReactNode, useCallback, useState } from "react";
import "./EditorBlock.css";

/**
 * One part of a long editor — a section, a screen, the opening — under a
 * header that folds it away.
 *
 * Folded, the body stays mounted and is only hidden: the rich editors and a
 * capture in flight inside it carry on, and unfolding shows them as they
 * were.
 */
export function EditorBlock({
  actions,
  children,
  collapsed,
  handle,
  onToggle,
  title,
}: {
  /** Buttons at the header's end, such as Remove. */
  actions?: ReactNode;
  children: ReactNode;
  collapsed: boolean;
  /** The drag handle, when the block can be reordered. */
  handle?: ReactNode;
  onToggle: () => void;
  title: ReactNode;
}) {
  return (
    <section
      className={`editor-block ${collapsed ? "editor-block--collapsed" : ""}`}
    >
      <header className="editor-block__header">
        {handle}
        <button
          aria-expanded={!collapsed}
          className="editor-block__toggle"
          onClick={onToggle}
          type="button"
        >
          <ChevronRight
            aria-hidden
            className="editor-block__chevron"
            size={14}
          />
          <span className="editor-block__title">{title}</span>
        </button>
        {actions ? (
          <div className="editor-block__actions">{actions}</div>
        ) : null}
      </header>
      <div className="editor-block__body" hidden={collapsed}>
        {children}
      </div>
    </section>
  );
}

const read = (key: string): Record<string, boolean> => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
};

/**
 * Which blocks are folded, kept per editor (the key) so a long review opens
 * the way it was left.
 */
export const useCollapsedBlocks = (storageKey: string) => {
  const [folded, setFolded] = useState<Record<string, boolean>>(() =>
    read(storageKey)
  );

  const save = useCallback(
    (next: Record<string, boolean>) => {
      setFolded(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Private mode: folding still works, it is just not remembered.
      }
    },
    [storageKey]
  );

  return {
    isCollapsed: (id: string) => folded[id] === true,
    /** Folds every listed block, or unfolds them all. */
    setAll: (ids: string[], collapsed: boolean) =>
      save(Object.fromEntries(ids.map((id) => [id, collapsed]))),
    toggle: (id: string) => save({ ...folded, [id]: !folded[id] }),
  };
};

export type CollapsedBlocks = ReturnType<typeof useCollapsedBlocks>;
