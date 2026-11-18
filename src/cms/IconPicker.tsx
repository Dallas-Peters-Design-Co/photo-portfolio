import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import ArrowDown01Icon from "@hugeicons-pro/core-stroke-standard/ArrowDown01Icon";
import UnavailableIcon from "@hugeicons-pro/core-stroke-standard/UnavailableIcon";
import { useEffect, useRef, useState } from "react";
import { type IconLibrary, type IconSet, useIconLibrary } from "./iconLibrary";
import { ICON_GROUPS, type IconGroup } from "./icons";
import { resolveIcon } from "./resolveIcon";

/** Where a capital or a digit starts a new word. */
const WORD_BREAK = /(?<=[a-z])(?=[A-Z0-9])/g;
const ICON_SUFFIX = /Icon$/;
const WHITESPACE = /\s+/;

/**
 * "Camera01Icon" → "Camera 01".
 *
 * The stored value is the pack's export name, which is what has to go in the
 * database, but showing it raw makes the field read like a variable rather
 * than a choice.
 */
const labelFor = (name: string): string =>
  name.replace(ICON_SUFFIX, "").replace(WORD_BREAK, " ").trim();

interface IconPickerProps {
  /** False when something must always be chosen, as for an icon element. */
  allowNone?: boolean;
  id?: string;
  /** Expand within the form when a floating list would overlap adjacent fields. */
  inline?: boolean;
  /** Names the trigger when no visible label points at it. */
  label?: string;
  /**
   * "full" searches the whole pack (~6,000 icons), loaded when the picker
   * opens. Only for admin-only drawings: the page editor's icons ship to
   * every visitor, so it keeps the curated set.
   */
  library?: "curated" | "full";
  /** The chosen icon's drawing, passed along so it can be saved with it. */
  onChange: (icon: string | null, svg?: IconSvgElement) => void;
  /** sm matches the other small controls in a dense form. */
  size?: "default" | "sm";
  /** A drawing to show for `value` when it is not in the curated set. */
  svg?: IconSvgElement | null;
  value: string | null;
}

/** Enough to scan; a longer list means the search should be narrower. */
const MAX_RESULTS = 240;

const TRIGGER_SIZES = {
  default: "min-h-11 px-3",
  sm: "h-7 px-2",
} as const;

interface IconSearch {
  matches: IconGroup[];
  status: string | null;
}

/**
 * The groups to show for a query. The curated set matches on icon name or
 * group label, so "nature" and "leaf" both land. With the full library
 * (`full` loaded, or null while loading), a query searches every icon and
 * every word must appear in the name.
 */
const searchIcons = (
  query: string,
  full: IconLibrary | null | undefined
): IconSearch => {
  const needle = query.trim().toLowerCase();
  const words = needle.split(WHITESPACE).filter(Boolean);
  if (full && words.length > 0) {
    const found = full.names.filter((name) => {
      const lower = name.toLowerCase();
      return words.every((word) => lower.includes(word));
    });
    const label =
      found.length > MAX_RESULTS
        ? `${MAX_RESULTS} of ${found.length} — narrow the search`
        : `All icons · ${found.length}`;
    return {
      matches: [{ icons: found.slice(0, MAX_RESULTS), label }],
      status: null,
    };
  }
  const curated = needle
    ? ICON_GROUPS.map((group) =>
        group.label.toLowerCase().includes(needle)
          ? group
          : {
              ...group,
              icons: group.icons.filter((name) =>
                name.toLowerCase().includes(needle)
              ),
            }
      ).filter((group) => group.icons.length > 0)
    : ICON_GROUPS;
  let status: string | null = null;
  if (full === null) {
    status = "Loading the full library…";
  } else if (full) {
    status = `Search all ${full.names.length.toLocaleString()} icons`;
  }
  return { matches: curated, status };
};

const iconSetOf = (name: string | null): IconSet =>
  name?.startsWith("Filled") ? "filled" : "stroke";

function selectedDrawing(
  name: string | null,
  set: IconSet,
  library: IconLibrary | null
) {
  const curated = resolveIcon(name);
  if (curated || !name || set !== iconSetOf(name)) {
    return curated;
  }
  return library?.icons[set === "filled" ? name.slice("Filled".length) : name];
}

/**
 * Visual icon chooser for a page's nav link.
 *
 * Replaces a free-text field that required knowing an exact icon-pack export
 * name — every option here is picked from a verified set, so a selection always
 * renders.
 */
export function IconPicker({
  allowNone = true,
  id,
  inline = false,
  label,
  library = "curated",
  onChange,
  size = "default",
  svg,
  value,
}: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click and on Escape, the way a native select behaves.
  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const currentSet = iconSetOf(value);
  const [set, setIconSet] = useState<IconSet>(currentSet);
  const full = useIconLibrary(library === "full" && open, set);
  const storedName = (name: string) =>
    set === "filled" ? `Filled${name}` : name;
  const iconOf = (name: string) =>
    full?.icons[name] ?? resolveIcon(storedName(name));
  const Selected = svg ?? selectedDrawing(value, set, full);
  const choose = (name: string | null) => {
    onChange(
      name ? storedName(name) : null,
      name ? (iconOf(name) ?? undefined) : undefined
    );
    setOpen(false);
  };

  const { matches, status } = searchIcons(
    query,
    library === "full" ? full : undefined
  );

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={label}
        className={`flex ${TRIGGER_SIZES[size]} w-full items-center justify-between gap-2 rounded-control border border-white/10 bg-black/40 text-left transition-colors hover:border-white/25 focus:border-white/40 focus:outline-none`}
        id={id}
        onClick={() => {
          if (!open) {
            setIconSet(currentSet);
          }
          setOpen(!open);
        }}
        title={value ? labelFor(value) : undefined}
        type="button"
      >
        {/* One line, cut short with an ellipsis: in a narrow table cell a
            long name ("More horizontal") wrapped over its own chevron. */}
        <span className="flex min-w-0 items-center gap-2 text-sm text-white/80">
          {Selected ? (
            <>
              <HugeiconsIcon className="shrink-0" icon={Selected} size={16} />
              <span className="truncate text-sm text-white/90 uppercase">
                {labelFor(value ?? "")}
              </span>
            </>
          ) : (
            <span className="truncate text-sm text-white/90 uppercase">
              No icon
            </span>
          )}
        </span>
        <HugeiconsIcon
          className={`shrink-0 text-white/90 transition-transform ${open ? "rotate-180" : ""}`}
          icon={ArrowDown01Icon}
          size={14}
        />
      </button>

      {open ? (
        <div
          className={`mt-1 max-h-72 w-full overflow-y-auto rounded-surface border border-white/15 bg-black ${inline ? "" : "absolute z-50 min-w-70 shadow-2xl"}`}
          role="listbox"
        >
          {/* Sticky so the field stays reachable while scrolling 185 icons. */}
          <div className="sticky top-0 z-10 border-white/10 border-b bg-black p-2">
            <label className="flex items-center gap-2 pb-2 text-xs">
              Icon set
              <select
                onChange={(event) =>
                  setIconSet(
                    event.target.value === "filled" ? "filled" : "stroke"
                  )
                }
                value={set}
              >
                <option value="stroke">Hugeicons Stroke</option>
                <option value="filled">Hugeicons Filled</option>
              </select>
            </label>
            <input
              autoFocus
              className="min-h-9 w-full rounded-control border border-white/10 bg-black/60 px-2 text-white/90 text-xs outline-none focus:border-white/40"
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search icons…"
              type="search"
              value={query}
            />
          </div>

          {allowNone ? (
            <button
              aria-selected={value === null}
              className={`flex w-full items-center gap-2 rounded-inner px-3 py-2.5 text-left text-sm uppercase transition-colors hover:bg-white/6 ${
                value === null ? "text-white" : "text-white/90"
              }`}
              onClick={() => choose(null)}
              role="option"
              type="button"
            >
              <HugeiconsIcon icon={UnavailableIcon} size={14} />
              No icon
            </button>
          ) : null}

          {status ? (
            <p className="px-3 py-2 text-white/50 text-xs">{status}</p>
          ) : null}

          {matches.every((group) => group.icons.length === 0) ? (
            <p className="px-3 py-3 text-sm text-white/50">
              Nothing matches “{query.trim()}”.
            </p>
          ) : null}

          {matches.map((group) => (
            <div className="border-white/6 border-t" key={group.label}>
              <p className="px-3 pt-3 pb-1.5 text-sm text-white/80 uppercase tracking-micro-widest">
                {group.label}
              </p>
              <div className="grid grid-cols-6 gap-px p-1">
                {group.icons.map((name) => {
                  const Icon = iconOf(name);
                  if (!Icon) {
                    return null;
                  }
                  return (
                    <button
                      aria-selected={value === storedName(name)}
                      className={`flex aspect-square items-center justify-center rounded-inner transition-colors ${
                        value === storedName(name)
                          ? "bg-white text-black"
                          : "text-white/90 hover:bg-white/8 hover:text-white"
                      }`}
                      key={name}
                      onClick={() => choose(name)}
                      role="option"
                      title={labelFor(name)}
                      type="button"
                    >
                      <HugeiconsIcon icon={Icon} size={16} />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
