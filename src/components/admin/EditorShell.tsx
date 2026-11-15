import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { type CSSProperties, type ReactNode, useId, useState } from "react";
import { BackButton } from "./BackButton";
import "./EditorShell.css";

/**
 * The frame every admin editor sits in — a review, a brand kit: a panel on
 * the left with everything that is not the content (the way back, saving,
 * settings), and the content beside it in blocks that fold away
 * (EditorBlock). The panel closes to a rail; whether it is open is remembered
 * per editor in this browser.
 */

const readOpen = (key: string): boolean => {
  try {
    return localStorage.getItem(key) !== "false";
  } catch {
    return true;
  }
};

export const usePanelOpen = (storageKey: string) => {
  const [open, setOpen] = useState(() => readOpen(storageKey));
  const toggle = () => {
    setOpen(!open);
    try {
      localStorage.setItem(storageKey, String(!open));
    } catch {
      // Not remembered in private mode.
    }
  };
  return { open, toggle };
};

/** A titled group in the panel, ruled off from the one above. */
export function PanelGroup({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="editor-shell__group">
      <h3 className="editor-shell__group-title">{title}</h3>
      {children}
    </section>
  );
}

export function EditorShell({
  backLabel,
  children,
  label,
  onBack,
  panel,
  storageKey,
  style,
}: {
  /** Names where the back button goes, e.g. "Reviews". */
  backLabel: string;
  /** The content, in EditorBlocks. */
  children: ReactNode;
  /** The panel's accessible name, e.g. "Review settings". */
  label: string;
  onBack: () => void;
  /** What the panel holds: its title, then PanelGroups. */
  panel: ReactNode;
  /** Where the panel's open state is remembered. */
  storageKey: string;
  style?: CSSProperties;
}) {
  const { open, toggle } = usePanelOpen(storageKey);
  const bodyId = useId();
  const ToggleIcon = open ? PanelLeftClose : PanelLeftOpen;
  const toggleLabel = open ? "Close the panel" : "Open the panel";

  return (
    <div
      className={`editor-shell ${open ? "" : "editor-shell--closed"}`}
      style={style}
    >
      <aside aria-label={label} className="editor-shell__panel">
        <div className="editor-shell__bar">
          {open ? <BackButton label={backLabel} onClick={onBack} /> : null}
          <button
            aria-controls={bodyId}
            aria-expanded={open}
            aria-label={toggleLabel}
            className="editor-shell__toggle"
            onClick={toggle}
            title={toggleLabel}
            type="button"
          >
            <ToggleIcon aria-hidden size={16} />
          </button>
        </div>
        <div className="editor-shell__body" hidden={!open} id={bodyId}>
          {panel}
        </div>
      </aside>
      <div className="editor-shell__content">{children}</div>
    </div>
  );
}
