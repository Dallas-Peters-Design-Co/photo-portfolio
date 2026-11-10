import { HugeiconsIcon } from "@hugeicons/react";
import ArrowDown01Icon from "@hugeicons-pro/core-stroke-standard/ArrowDown01Icon";
import ArrowRight01Icon from "@hugeicons-pro/core-stroke-standard/ArrowRight01Icon";
import Delete02Icon from "@hugeicons-pro/core-stroke-standard/Delete02Icon";
import DragDropVerticalIcon from "@hugeicons-pro/core-stroke-standard/DragDropVerticalIcon";
import { useState } from "react";
import { Control } from "./Control";
import { groupProps, type ShaderLayer, shaderMeta } from "./shaderConfig";
import type { Chain } from "./shaderStack";
import "./EffectStack.css";

/**
 * A stack that is a chain, shown as the list it is.
 *
 * Effects top to bottom, the source (or the wired picture) underneath. Each
 * effect has a switch, so a step can be tried with and without, and a handle
 * to drag it to another place in the order. Settings open under a row rather
 * than beside it, so the list keeps its shape while one row is being worked.
 */

interface RowProps {
  canDrag: boolean;
  dragging: boolean;
  layer: ShaderLayer;
  onDragEnd: () => void;
  onDragStart: () => void;
  onDrop: () => void;
  onRemove: () => void;
  onSetProp: (key: string, value: unknown) => void;
  onToggle: (() => void) | null;
}

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
/** "GlassTiles" reads as "Glass Tiles". */
const CAMEL_SEAM = /(?<lower>[a-z])(?<upper>[A-Z])/g;

function Row({
  canDrag,
  dragging,
  layer,
  onDragEnd,
  onDragStart,
  onDrop,
  onRemove,
  onSetProp,
  onToggle,
}: RowProps) {
  const [open, setOpen] = useState(false);
  const meta = shaderMeta(layer.name);
  const on = layer.enabled !== false;
  const label = layer.name.replace(CAMEL_SEAM, "$1 $2");
  return (
    // The row is where a dragged row lands; the handle it is dragged by is a
    // button, and the keyboard has the up/down order through the tree view.
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: drop target for the drag handle
    <li
      className={`effect-row ${on ? "" : "effect-row--off"} ${
        dragging ? "effect-row--dragging" : ""
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
    >
      <div className="effect-row__header">
        {canDrag ? (
          <button
            aria-label={`Drag to reorder ${label}`}
            className="effect-row__handle"
            draggable
            onDragEnd={onDragEnd}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              onDragStart();
            }}
            onPointerDown={stop}
            type="button"
          >
            <HugeiconsIcon icon={DragDropVerticalIcon} size={12} />
          </button>
        ) : (
          <span className="effect-row__handle effect-row__handle--none" />
        )}
        <button
          aria-expanded={open}
          className="effect-row__name"
          onClick={() => setOpen((o) => !o)}
          onPointerDown={stop}
          type="button"
        >
          {label}
        </button>
        {onToggle ? (
          <button
            aria-checked={on}
            aria-label={`${on ? "Switch off" : "Switch on"} ${label}`}
            className="effect-row__switch"
            onClick={onToggle}
            onPointerDown={stop}
            role="switch"
            type="button"
          >
            <span className="effect-row__knob" />
          </button>
        ) : null}
        <button
          aria-label={`Remove ${label}`}
          className="effect-row__control"
          onClick={onRemove}
          onPointerDown={stop}
          type="button"
        >
          <HugeiconsIcon icon={Delete02Icon} size={12} />
        </button>
        <button
          aria-label={`${open ? "Hide" : "Show"} ${label} settings`}
          className="effect-row__control"
          onClick={() => setOpen((o) => !o)}
          onPointerDown={stop}
          type="button"
        >
          <HugeiconsIcon
            icon={open ? ArrowDown01Icon : ArrowRight01Icon}
            size={12}
          />
        </button>
      </div>
      {open ? (
        <div className="effect-row__settings">
          {meta === null ? (
            <p className="shader-layer__note shader-layer__note--missing">
              This shader is not in the installed package.
            </p>
          ) : null}
          {meta !== null && meta.props.length === 0 ? (
            <p className="shader-layer__note shader-layer__note--quiet">
              No settings.
            </p>
          ) : null}
          {meta === null
            ? null
            : groupProps(meta.props).map(({ group, props }) => (
                <div className="shader-layer__prop-group" key={group}>
                  <p className="shader-layer__group-title">{group}</p>
                  {props.map((prop) => (
                    <Control
                      key={prop.key}
                      onChange={(value) => onSetProp(prop.key, value)}
                      prop={prop}
                      value={layer.props[prop.key]}
                    />
                  ))}
                </div>
              ))}
        </div>
      ) : null}
    </li>
  );
}

export interface EffectStackProps {
  chain: Chain;
  onChange: (chain: Chain) => void;
  /** Opens the picker for a new effect (above) or source (below). */
  onPick: (wanting: "source" | "effect") => void;
  /** True when a picture wired into the item is the source. */
  wiredSource: boolean;
}

export function EffectStack({
  chain,
  onChange,
  onPick,
  wiredSource,
}: EffectStackProps) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const { effects, source } = chain;
  const update = (id: string, fn: (layer: ShaderLayer) => ShaderLayer) =>
    onChange({
      effects: effects.map((l) => (l.id === id ? fn(l) : l)),
      source: source?.id === id ? fn(source) : source,
    });

  return (
    <div className="effect-stack">
      <div className="effect-stack__add-row">
        <button
          className="shader-controls__add shader-controls__add--root"
          onClick={() => onPick("effect")}
          onPointerDown={stop}
          type="button"
        >
          Add effect
        </button>
      </div>
      <ol className="effect-stack__list">
        {effects.map((layer, index) => (
          <Row
            canDrag={effects.length > 1}
            dragging={dragFrom === index}
            key={layer.id}
            layer={layer}
            onDragEnd={() => setDragFrom(null)}
            onDragStart={() => setDragFrom(index)}
            onDrop={() => {
              if (dragFrom !== null && dragFrom !== index) {
                const next = [...effects];
                const [item] = next.splice(dragFrom, 1);
                if (item) {
                  next.splice(index, 0, item);
                }
                onChange({ effects: next, source });
              }
              setDragFrom(null);
            }}
            onRemove={() =>
              onChange({
                effects: effects.filter((l) => l.id !== layer.id),
                source,
              })
            }
            onSetProp={(key, value) =>
              update(layer.id, (l) => ({
                ...l,
                props: { ...l.props, [key]: value },
              }))
            }
            onToggle={() =>
              update(layer.id, (l) => ({ ...l, enabled: l.enabled === false }))
            }
          />
        ))}
        {source ? (
          <Row
            canDrag={false}
            dragging={false}
            key={source.id}
            layer={source}
            onDragEnd={() => undefined}
            onDragStart={() => undefined}
            onDrop={() => undefined}
            onRemove={() => onChange({ effects, source: null })}
            onSetProp={(key, value) =>
              update(source.id, (l) => ({
                ...l,
                props: { ...l.props, [key]: value },
              }))
            }
            onToggle={null}
          />
        ) : null}
      </ol>
      {source ? null : (
        <div className="effect-stack__source">
          {wiredSource ? (
            <p className="shader-layer__note">
              The picture wired into this item. Unplug it to draw something
              else.
            </p>
          ) : (
            <>
              <p className="shader-layer__note shader-layer__note--warn">
                Nothing to work on yet.
              </p>
              <button
                className="shader-controls__add shader-controls__add--root"
                onClick={() => onPick("source")}
                onPointerDown={stop}
                type="button"
              >
                Add source
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
