import { X } from "lucide-react";
import { type Command, formatKeys } from "./keys";
import "./shortcuts.css";

/** Every shortcut, grouped, as a sheet over the screen. ? opens it, Esc closes. */
export function ShortcutSheet({
  commands,
  onClose,
  title = "Keyboard shortcuts",
}: {
  commands: Command[];
  onClose: () => void;
  title?: string;
}) {
  const groups = [...new Set(commands.map((c) => c.group))];
  return (
    <div className="palette" onPointerDown={onClose}>
      <div
        aria-label={title}
        aria-modal
        className="sheet"
        onPointerDown={(e) => e.stopPropagation()}
        role="dialog"
      >
        <header className="sheet__head">
          <strong>{title}</strong>
          <button
            aria-label="Close"
            className="sheet__close"
            onClick={onClose}
            type="button"
          >
            <X size={15} />
          </button>
        </header>
        <div className="sheet__groups">
          {groups.map((group) => (
            <section className="sheet__group" key={group}>
              <h3>{group}</h3>
              <dl>
                {commands
                  .filter((c) => c.group === group && c.keys?.length)
                  .map((c) => (
                    <div className="sheet__row" key={c.id}>
                      <dt>{c.label}</dt>
                      <dd>
                        {c.keys?.map((k) => (
                          <kbd key={k}>{formatKeys(k)}</kbd>
                        ))}
                      </dd>
                    </div>
                  ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
