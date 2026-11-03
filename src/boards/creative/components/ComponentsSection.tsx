import {
  Boxes,
  Check,
  Component as ComponentIcon,
  Palette,
  PencilRuler,
  Plus,
  RotateCcw,
  Trash2,
  Type,
  Unlink,
  X,
} from "lucide-react";
import type { BoardItem } from "../../../types";
import { ColorWell } from "../../ColorWell";
import { FIELDS_OF, instanceOf, propValue } from "../../components/model";
import { editLinkOf, type useComponents } from "./useComponents";
import "./Components.css";

/**
 * The rail's Components section. Three states:
 *
 * - nothing special selected: the brand's components (click to place one)
 *   and Make component from the selection;
 * - an instance selected: its properties (an input for text, a colour
 *   picker for colours), and Edit component, Reset, Detach;
 * - a component open for editing: Done and Cancel, its properties, and for
 *   the selected layer, which of its text or colours to expose.
 *
 * Kept in the rail rather than over the artboard so selecting never changes
 * the artboard's height (a bar coming and going made it jump).
 */
export function ComponentsSection({
  chosen,
  comps,
}: {
  chosen: BoardItem[];
  comps: ReturnType<typeof useComponents>;
}) {
  if (comps.editing) {
    return <EditingSection chosen={chosen} comps={comps} />;
  }
  const [only] = chosen.length === 1 ? chosen : [];
  const instance = only ? instanceOf(only) : null;
  const component = instance ? comps.lookup(instance.component) : null;
  return (
    <section className="components">
      <p className="creative__label">
        Components{comps.kitName ? ` · ${comps.kitName}` : ""}
      </p>
      {only && instance && component ? (
        <div className="components__panel">
          <p className="components__title">
            <ComponentIcon size={13} /> {component.name}
          </p>
          {component.props.length === 0 ? (
            <p className="creative__hint">
              Nothing to set yet. Edit component and expose its text or colours.
            </p>
          ) : null}
          {component.props.map((prop) => {
            const value = propValue(component, prop, instance.props);
            return prop.type === "text" ? (
              <label className="components__prop" key={prop.id}>
                <span>{prop.name}</span>
                <textarea
                  className="creative__input components__text"
                  onChange={(e) => comps.setProp(only, prop.id, e.target.value)}
                  rows={Math.min(4, value.split("\n").length)}
                  value={value}
                />
              </label>
            ) : (
              <div
                className="components__prop components__prop--color"
                key={prop.id}
              >
                <span>{prop.name}</span>
                <ColorWell
                  label={prop.name}
                  onChange={(c) => comps.setProp(only, prop.id, c)}
                  value={value || "#000000"}
                />
              </div>
            );
          })}
          <div className="components__actions">
            <button
              className="creative__add"
              onClick={() => comps.startEdit(only)}
              title="Open the component to change it; every copy follows"
              type="button"
            >
              <PencilRuler size={14} /> Edit component
            </button>
            <button
              className="creative__add"
              disabled={Object.keys(instance.props).length === 0}
              onClick={() => comps.resetProps(only)}
              title="Put this copy's properties back to the component's"
              type="button"
            >
              <RotateCcw size={14} /> Reset
            </button>
            <button
              className="creative__add"
              onClick={() => comps.detach(only)}
              title="Make this copy ordinary layers, no longer linked"
              type="button"
            >
              <Unlink size={14} /> Detach
            </button>
          </div>
        </div>
      ) : null}
      {comps.kitName ? (
        <>
          {comps.components.length > 0 ? (
            <ul className="components__list">
              {comps.components.map((c) => (
                <li className="components__row" key={c.id}>
                  <button
                    className="components__insert"
                    onClick={() => comps.insert(c)}
                    title={`Add ${c.name} to this frame`}
                    type="button"
                  >
                    <ComponentIcon size={13} />
                    <span>{c.name}</span>
                  </button>
                  <button
                    aria-label={`Delete ${c.name}`}
                    className="components__icon"
                    onClick={() => void comps.remove(c)}
                    title="Delete the component"
                    type="button"
                  >
                    <Trash2 size={12} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <button
            className="creative__add components__make"
            disabled={chosen.length === 0 || Boolean(instance)}
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
    </section>
  );
}

function EditingSection({
  chosen,
  comps,
}: {
  chosen: BoardItem[];
  comps: ReturnType<typeof useComponents>;
}) {
  const { editing } = comps;
  if (!editing) {
    return null;
  }
  const [only] = chosen.length === 1 ? chosen : [];
  const link = only ? editLinkOf(only) : null;
  const inThis = link?.i === editing.instance.id;
  const fields = only ? (FIELDS_OF[only.kind] ?? []) : [];
  return (
    <section className="components components--editing">
      <p className="components__title">
        <PencilRuler size={13} /> Editing {editing.component.name}
      </p>
      <div className="components__actions">
        <button
          className="creative__add components__done"
          onClick={() => void comps.finishEdit(true)}
          type="button"
        >
          <Check size={14} /> Done
        </button>
        <button
          className="creative__add"
          onClick={() => void comps.finishEdit(false)}
          type="button"
        >
          <X size={14} /> Cancel
        </button>
      </div>
      <p className="creative__label">Properties</p>
      {editing.props.length === 0 ? (
        <p className="creative__hint">
          Select a layer of the component to let each copy change its text or
          colours.
        </p>
      ) : (
        <ul className="components__list">
          {editing.props.map((prop) => (
            <li className="components__row components__row--prop" key={prop.id}>
              {prop.type === "text" ? (
                <Type size={13} />
              ) : (
                <Palette size={13} />
              )}
              <input
                aria-label="Property name"
                className="creative__input components__name"
                onChange={(e) =>
                  comps.setProps(
                    editing.props.map((p) =>
                      p.id === prop.id ? { ...p, name: e.target.value } : p
                    )
                  )
                }
                value={prop.name}
              />
              <button
                aria-label={`Stop exposing ${prop.name}`}
                className="components__icon components__icon--shown"
                onClick={() =>
                  comps.setProps(editing.props.filter((p) => p.id !== prop.id))
                }
                type="button"
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {only && inThis && link && fields.length > 0 ? (
        <div className="components__expose">
          <p className="creative__label">Expose from this layer</p>
          {fields.map((f) => {
            const on = editing.props.some(
              (p) => p.lid === link.l && p.field === f.field
            );
            return (
              <button
                aria-pressed={on}
                className="creative__add"
                disabled={on}
                key={f.field}
                onClick={() => comps.expose(only, f.field, f.label, f.type)}
                type="button"
              >
                {on ? <Check size={14} /> : <Plus size={14} />} {f.label}
              </button>
            );
          })}
        </div>
      ) : null}
      {only && !link && only.kind !== "component" ? (
        <button
          className="creative__add"
          onClick={() => comps.addToComponent(only)}
          title="Make this layer part of the component"
          type="button"
        >
          <Plus size={14} /> Add to component
        </button>
      ) : null}
    </section>
  );
}
