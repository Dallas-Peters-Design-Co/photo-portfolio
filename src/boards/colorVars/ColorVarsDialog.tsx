import { Plus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useActiveBrand } from "../brand/ActiveBrand";
import { ColorWell } from "../ColorWell";
import { type ColorVar, rgbOf, varFor } from "./colorVars";
import { useColorVars } from "./useColorVars";
import "./ColorVars.css";

/** How long a colour has to sit still before the board follows it. */
const SETTLE_MS = 350;

/**
 * One variable: its colour, its name, and a way to drop it. The colour is
 * held here while it's being dragged and handed on once it settles, so a
 * drag is one change to the board rather than a hundred.
 */
function VarRow({ v }: { v: ColorVar }) {
  const ctx = useColorVars();
  const [draft, setDraft] = useState(v.value);
  const [name, setName] = useState(v.name);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => setDraft(v.value), [v.value]);
  useEffect(() => setName(v.name), [v.name]);
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    []
  );
  if (!ctx) {
    return null;
  }
  const pick = (next: string) => {
    setDraft(next);
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => ctx.setValue(v.id, next), SETTLE_MS);
  };
  return (
    <li className="color-vars__row">
      <ColorWell
        alpha={false}
        label={`${v.name} colour`}
        noVars
        onChange={pick}
        value={draft}
      />
      <input
        aria-label="Name"
        className="color-vars__name"
        onBlur={() => name.trim() !== v.name && ctx.rename(v.id, name)}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        value={name}
      />
      <code className="color-vars__hex">{rgbOf(draft)}</code>
      <button
        aria-label={`Remove ${v.name}`}
        className="color-vars__icon"
        onClick={() => ctx.remove(v.id)}
        title="Remove the variable (the colours stay where they are)"
        type="button"
      >
        <Trash2 size={13} />
      </button>
    </li>
  );
}

/** The board's colour variables, to name, change and add to. */
export function ColorVarsDialog({ brand }: { brand: string[] }) {
  const ctx = useColorVars();
  const kit = useActiveBrand()?.kit?.resolvedDoc.palette ?? [];
  if (!ctx) {
    return null;
  }
  const unused = kit.filter((p) => !varFor(p.value, ctx.vars));
  const addOne = () => {
    const free = brand.find((c) => !varFor(c, ctx.vars)) ?? "#888888";
    ctx.add(free);
  };
  const addBrand = () =>
    ctx.addAll(
      unused.map((p) => ({ name: p.name || p.role || "Brand", value: p.value }))
    );
  return createPortal(
    <>
      <button
        aria-label="Close colour variables"
        className="color-vars__scrim"
        onClick={ctx.close}
        type="button"
      />
      <div
        aria-label="Colour variables"
        className="color-vars"
        onPointerDown={(e) => e.stopPropagation()}
        role="dialog"
      >
        <header className="color-vars__head">
          <strong>Colour variables</strong>
          <button
            aria-label="Close"
            className="color-vars__icon"
            onClick={ctx.close}
            type="button"
          >
            <X size={14} />
          </button>
        </header>
        <p className="color-vars__note">
          Change a colour here and every layer on this board in that colour
          changes with it: text, shapes, frames, components and Studio pictures.
        </p>
        {ctx.vars.length > 0 ? (
          <ul className="color-vars__list">
            {ctx.vars.map((v) => (
              <VarRow key={v.id} v={v} />
            ))}
          </ul>
        ) : (
          <p className="color-vars__empty">No variables yet.</p>
        )}
        <footer className="color-vars__foot">
          <button className="color-vars__add" onClick={addOne} type="button">
            <Plus size={13} /> Add colour
          </button>
          {unused.length > 0 ? (
            <button
              className="color-vars__add"
              onClick={addBrand}
              type="button"
            >
              <Plus size={13} /> Add the brand's {unused.length}
            </button>
          ) : null}
        </footer>
      </div>
    </>,
    document.body
  );
}
