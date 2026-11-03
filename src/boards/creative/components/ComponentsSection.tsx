import {
  Boxes,
  Component as ComponentIcon,
  RefreshCw,
  RotateCcw,
  SquareDashed,
  Trash2,
  Unlink,
} from "lucide-react";
import type { BoardItem } from "../../../types";
import type { useComponents } from "./useComponents";
import "./Components.css";

/**
 * The rail's Components section: the active brand's components (click one to
 * drop a copy in), making one from the selection, and, when the selection is
 * part of a copy, what can be done with that copy.
 *
 * Kept in the rail rather than over the artboard so selecting a copy never
 * changes the artboard's height (a bar coming and going made it jump).
 */
export function ComponentsSection({
  chosen,
  comps,
}: {
  chosen: BoardItem[];
  comps: ReturnType<typeof useComponents>;
}) {
  const [first] = chosen;
  const component = first ? comps.componentOf(first) : null;
  return (
    <section className="components">
      <p className="creative__label">
        Components{comps.kitName ? ` · ${comps.kitName}` : ""}
      </p>
      {comps.kitName ? (
        <>
          {comps.components.length > 0 ? (
            <ul className="components__list">
              {comps.components.map((c) => (
                <li className="components__row" key={c.id}>
                  <button
                    className="components__insert"
                    onClick={() => comps.insert(c)}
                    title={`Add a copy of ${c.name} to this frame`}
                    type="button"
                  >
                    <ComponentIcon size={13} />
                    <span>{c.name}</span>
                  </button>
                  <button
                    aria-label={`Delete ${c.name}`}
                    className="components__icon"
                    onClick={() => void comps.remove(c)}
                    title="Delete the component (copies stay, unlinked)"
                    type="button"
                  >
                    <Trash2 size={12} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="creative__hint">
              Select layers and make them a component to reuse them in any
              frame.
            </p>
          )}
          <button
            className="creative__add components__make"
            disabled={chosen.length === 0}
            onClick={() => void comps.make(chosen)}
            title="Save the selected layers as a component of this brand"
            type="button"
          >
            <Boxes size={15} /> Make component
          </button>
        </>
      ) : (
        <p className="creative__hint">
          Choose a brand in the Brand panel to make and use components.
        </p>
      )}
      {first && component ? (
        <div className="components__copy">
          <p className="components__copy-name">
            <ComponentIcon size={13} /> {component.name}
          </p>
          <div className="components__actions">
            <button
              className="creative__add"
              onClick={() => comps.selectCopy(first)}
              title="Select every layer of this copy"
              type="button"
            >
              <SquareDashed size={14} /> Select copy
            </button>
            <button
              className="creative__add"
              onClick={() => void comps.update(first)}
              title="Make the component match this copy; every copy follows (each keeps its own text, colours and font size)"
              type="button"
            >
              <RefreshCw size={14} /> Update all
            </button>
            <button
              className="creative__add"
              onClick={() => comps.reset(first)}
              title="Put this copy back to exactly the component"
              type="button"
            >
              <RotateCcw size={14} /> Reset copy
            </button>
            <button
              className="creative__add"
              onClick={() => comps.detach(first)}
              title="Make these ordinary layers, no longer linked"
              type="button"
            >
              <Unlink size={14} /> Detach
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
