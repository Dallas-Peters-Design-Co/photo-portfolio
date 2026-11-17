import { ChevronDown, Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * The public board's main action: every designed frame, as PNG and SVG, at
 * the size the visitor picks. 2× is the one most people want, so it is
 * marked; 3× is for print.
 */

const DENSITIES = [
  { density: 1, hint: "The frames' own size · 72 DPI", label: "1×" },
  { density: 2, hint: "Sharp on any screen · 144 DPI", label: "2×" },
  { density: 3, hint: "For print · 216 DPI", label: "3×" },
] as const;

export function DownloadFramesMenu({
  count,
  onPick,
}: {
  count: number;
  onPick: (density: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  return (
    <div className="board-view-page__download" ref={root}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className="board-view-page__action board-view-page__action--primary"
        onClick={() => setOpen((v) => !v)}
        title="Every designed frame, as PNG and SVG, in one zip"
        type="button"
      >
        <Download aria-hidden size={12} />
        Download frames ({count})
        <ChevronDown aria-hidden size={12} />
      </button>
      {open ? (
        <div className="board-view-page__sizes" role="menu">
          {DENSITIES.map((d) => (
            <button
              className="board-view-page__size"
              key={d.density}
              onClick={() => {
                setOpen(false);
                onPick(d.density);
              }}
              role="menuitem"
              type="button"
            >
              <strong>
                PNG + SVG at {d.label}
                {d.density === 2 ? " · recommended" : ""}
              </strong>
              <small>{d.hint}</small>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
