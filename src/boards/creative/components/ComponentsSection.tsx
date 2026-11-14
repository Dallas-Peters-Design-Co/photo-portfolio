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
import {
  alikeOf,
  type BrandComponent,
  type ComponentProp,
  FIELDS_OF,
  instanceOf,
  layerLabel,
  propValue,
  sets,
  targetsOf,
} from "../../components/model";
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
  // Instances of one component, picked together, are set together.
  const instances = chosen.map(instanceOf);
  const [first] = instances;
  const same =
    chosen.length > 0 &&
    instances.every((i) => i && i.component === first?.component);
  const component = same && first ? comps.lookup(first.component) : null;
  const instance = only && component ? first : null;
  return (
    <section className="components">
      <p className="creative__label">
        Components{comps.kitName ? ` · ${comps.kitName}` : ""}
      </p>
      {component ? (
        <div className="components__panel">
          <p className="components__title">
            <ComponentIcon size={13} /> {component.name}
            {chosen.length > 1 ? ` · ${chosen.length} copies` : ""}
          </p>
          {component.props.map((prop) => {
            const values = instances.map((i) =>
              propValue(component, prop, i?.props ?? {})
            );
            const mixed = new Set(values).size > 1;
            const value = mixed ? "" : (values[0] ?? "");
            return prop.type === "text" ? (
              <label className="components__prop" key={prop.id}>
                <span>{prop.name}</span>
                <textarea
                  className="creative__input components__text"
                  onChange={(e) =>
                    comps.setProp(chosen, prop.id, e.target.value)
                  }
                  placeholder={mixed ? "Mixed" : undefined}
                  rows={Math.min(4, Math.max(1, value.split("\n").length))}
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
                  onChange={(c) => comps.setProp(chosen, prop.id, c)}
                  value={value || values[0] || "#000000"}
                />
              </div>
            );
          })}
          <AddProperty component={component} comps={comps} />
          <div className="components__actions">
            {only ? (
              <button
                className="creative__add"
                onClick={() => comps.startEdit(only)}
                title="Open the component to change it; every copy follows"
                type="button"
              >
                <PencilRuler size={14} /> Edit component
              </button>
            ) : null}
            <button
              className="creative__add"
              disabled={instances.every(
                (i) => Object.keys(i?.props ?? {}).length === 0
              )}
              onClick={() => comps.resetProps(chosen)}
              title="Put these copies' properties back to the component's"
              type="button"
            >
              <RotateCcw size={14} /> Reset
            </button>
            {only ? (
              <button
                className="creative__add"
                onClick={() => comps.detach(only)}
                title="Make this copy ordinary layers, no longer linked"
                type="button"
              >
                <Unlink size={14} /> Detach
              </button>
            ) : null}
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
                title={
                  targetsOf(prop).length > 1
                    ? `Sets ${targetsOf(prop).length} layers`
                    : undefined
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
            const on = editing.props.some((p) => sets(p, link.l, f.field));
            return (
              <div className="components__expose-row" key={f.field}>
                <button
                  aria-pressed={on}
                  className="creative__add"
                  disabled={on}
                  onClick={() => comps.expose(only, f.field, f.label, f.type)}
                  title="A new property; layers with the same value share it"
                  type="button"
                >
                  {on ? <Check size={14} /> : <Plus size={14} />} {f.label}
                </button>
                {on ? null : (
                  <JoinSelect
                    onJoin={(id) => comps.share(only, f.field, id)}
                    props={editing.props}
                    type={f.type}
                  />
                )}
              </div>
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

/**
 * Every layer's text and colours that aren't properties yet, each one click
 * from becoming one. Open while the component has none, so the first thing
 * an instance shows is what can be made settable.
 */
function AddProperty({
  comps,
  component,
}: {
  comps: ReturnType<typeof useComponents>;
  component: BrandComponent;
}) {
  // Each field not set by a property yet, with the layers like it folded in:
  // six tiles the same colour are one choice, not six.
  const seen = new Set<string>();
  const options = component.layers.flatMap((layer) =>
    (FIELDS_OF[layer.kind] ?? [])
      .filter((f) => !component.props.some((p) => sets(p, layer.lid, f.field)))
      .filter((f) => !seen.has(`${layer.lid}:${f.field}`))
      .map((f) => {
        const alike =
          f.type === "color" ? alikeOf(component, layer.lid, f.field) : [];
        for (const t of alike) {
          seen.add(`${t.lid}:${t.field}`);
        }
        return { ...f, count: alike.length + 1, layer };
      })
  );
  if (options.length === 0) {
    return null;
  }
  return (
    <details className="components__add" open={component.props.length === 0}>
      <summary>
        <Plus size={13} /> Add a property
      </summary>
      <ul className="components__list">
        {options.map(({ count, field, label, layer, type }) => (
          <li className="components__row" key={`${layer.lid}-${field}`}>
            <button
              className="components__insert"
              onClick={() =>
                void comps.addProp(component, {
                  field,
                  lid: layer.lid,
                  name:
                    type === "text"
                      ? layerLabel(layer)
                      : `${count > 1 ? "Mark" : layerLabel(layer)} ${label.toLowerCase()}`,
                  type,
                })
              }
              title={
                count > 1
                  ? `${count} layers share this ${label.toLowerCase()}; one property sets them all`
                  : undefined
              }
              type="button"
            >
              {type === "text" ? <Type size={13} /> : <Palette size={13} />}
              <span>
                {layerLabel(layer)} · {label}
                {count > 1 ? ` · ${count} layers` : ""}
              </span>
            </button>
            <JoinSelect
              onJoin={(id) =>
                void comps.joinProp(component, id, { field, lid: layer.lid })
              }
              props={component.props}
              type={type}
            />
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * Sharing an existing property instead of making a new one: the mark's
 * colour set by the same Colour as the label.
 */
function JoinSelect({
  onJoin,
  props,
  type,
}: {
  onJoin: (propId: string) => void;
  props: ComponentProp[];
  type: ComponentProp["type"];
}) {
  const same = props.filter((p) => p.type === type);
  if (same.length === 0) {
    return null;
  }
  return (
    <select
      aria-label="Share a property"
      className="creative__input components__join"
      onChange={(e) => {
        if (e.target.value) {
          onJoin(e.target.value);
        }
      }}
      title="Set this by a property that's already there"
      value=""
    >
      <option value="">Share…</option>
      {same.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
