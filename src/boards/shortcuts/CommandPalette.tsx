import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { type Command, formatKeys } from "./keys";
import "./shortcuts.css";

/**
 * ⌘K: every command by name, with its shortcut beside it, plus whatever else
 * a `source` can find for the words typed (pages to go to, notes to open).
 * Arrows move, Enter runs, Esc closes.
 */

export interface PaletteItem {
  detail?: string;
  /** Shown, but greyed, when it can't run right now (nothing selected). */
  disabled?: boolean;
  group: string;
  id: string;
  keys?: string[];
  label: string;
  run: () => void;
}

/** Something searchable beyond the commands; asked again as the query changes. */
export interface PaletteSource {
  id: string;
  search: (query: string) => Promise<PaletteItem[]>;
}

const SPACES = /\s+/;

/** Every word of the query somewhere in the label, group or detail. */
export const fits = (item: PaletteItem, query: string): boolean => {
  const hay = `${item.label} ${item.group} ${item.detail ?? ""}`.toLowerCase();
  return query
    .toLowerCase()
    .split(SPACES)
    .filter(Boolean)
    .every((word) => hay.includes(word));
};

/** One empty list, so the default doesn't change on every render. */
const NO_SOURCES: PaletteSource[] = [];

const fromCommands = (commands: Command[]): PaletteItem[] =>
  commands.map(({ enabled, group, id, keys, label, run }) => ({
    detail: enabled === false ? "Select a layer first" : undefined,
    disabled: enabled === false,
    group,
    id,
    keys,
    label,
    run,
  }));

export function CommandPalette({
  commands,
  onClose,
  placeholder = "Search commands",
  sources = NO_SOURCES,
}: {
  commands: Command[];
  onClose: () => void;
  placeholder?: string;
  sources?: PaletteSource[];
}) {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<PaletteItem[]>([]);
  const [at, setAt] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    let alive = true;
    if (!query.trim() || sources.length === 0) {
      setFound([]);
      return;
    }
    const timer = setTimeout(() => {
      void Promise.all(
        sources.map((s) => s.search(query).catch(() => [] as PaletteItem[]))
      ).then((lists) => alive && setFound(lists.flat()));
    }, 120);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, sources]);

  const items = useMemo(
    () => [...fromCommands(commands).filter((c) => fits(c, query)), ...found],
    [commands, found, query]
  );
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${at}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [at]);

  const run = (item: PaletteItem | undefined) => {
    if (item && !item.disabled) {
      onClose();
      item.run();
    }
  };

  return (
    <div className="palette" onPointerDown={onClose}>
      <div
        aria-label="Command palette"
        aria-modal
        className="palette__box"
        onPointerDown={(e) => e.stopPropagation()}
        role="dialog"
      >
        <label className="palette__search">
          <Search aria-hidden size={16} />
          <input
            aria-label={placeholder}
            autoFocus
            onChange={(e) => {
              setQuery(e.target.value);
              setAt(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setAt((i) => Math.min(items.length - 1, i + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setAt((i) => Math.max(0, i - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                run(items[at]);
              } else if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }
            }}
            placeholder={placeholder}
            value={query}
          />
        </label>
        <ul className="palette__list" ref={listRef}>
          {items.length === 0 ? (
            <li className="palette__empty">Nothing matches.</li>
          ) : (
            items.map((item, i) => (
              <li key={`${item.group}:${item.id}`}>
                <button
                  aria-current={i === at}
                  className="palette__item"
                  data-index={i}
                  disabled={item.disabled}
                  onClick={() => run(item)}
                  onPointerMove={() => setAt(i)}
                  tabIndex={-1}
                  type="button"
                >
                  <span className="palette__group">{item.group}</span>
                  <span className="palette__label">
                    {item.label}
                    {item.detail ? <small>{item.detail}</small> : null}
                  </span>
                  {item.keys?.[0] ? (
                    <kbd className="palette__keys">
                      {formatKeys(item.keys[0])}
                    </kbd>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
