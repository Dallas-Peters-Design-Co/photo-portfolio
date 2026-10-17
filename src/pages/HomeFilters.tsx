import { HugeiconsIcon } from "@hugeicons/react";
import ArrowDown01Icon from "@hugeicons-pro/core-stroke-standard/ArrowDown01Icon";
import { useEffect, useId, useRef, useState } from "react";
import type { ViewMode } from "../types";

export interface FilterOption {
  key: ViewMode;
  label: string;
}

/**
 * The floating category filter. On a wide screen every filter sits in the
 * pill. On a phone the pill shows only the current one; tapping it opens the
 * rest above it (the pill sits at the foot of the screen), and choosing one,
 * tapping elsewhere or pressing Escape closes it again.
 */
export function HomeFilters({
  options,
  current,
  onSelect,
}: {
  options: FilterOption[];
  current: ViewMode;
  onSelect: (mode: ViewMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const navRef = useRef<HTMLElement>(null);
  const currentLabel =
    options.find((o) => o.key === current)?.label ?? options[0]?.label ?? "";

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointer = (e: PointerEvent) => {
      if (!navRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (mode: ViewMode) => {
    setOpen(false);
    onSelect(mode);
  };

  return (
    <nav
      aria-label="Filter portfolio by category"
      className="home-page__filters"
      data-open={open || undefined}
      ref={navRef}
    >
      <div className="row hairline home-page__filter-bar row--wrap">
        <button
          aria-controls={listId}
          aria-expanded={open}
          className="label home-page__filter home-page__filter--current home-page__filter-toggle"
          onClick={() => setOpen((v) => !v)}
          type="button"
        >
          {currentLabel}
          <HugeiconsIcon
            aria-hidden
            className="home-page__filter-chevron"
            icon={ArrowDown01Icon}
            size={12}
          />
        </button>
        <div className="home-page__filter-list" id={listId}>
          {options.map((option) => (
            <button
              aria-pressed={current === option.key}
              className={
                current === option.key
                  ? "label home-page__filter home-page__filter--current"
                  : "label home-page__filter"
              }
              key={option.key}
              onClick={() => choose(option.key)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
