import { Plus, SlidersHorizontal } from "lucide-react";
import { normalHex, varFor } from "./colorVars";
import { useColorVars } from "./useColorVars";
import "./ColorVars.css";

/**
 * The board's colour variables inside a colour picker: click one to use it
 * (keeping the colour's own transparency), save the colour as a new one, or
 * open the list to change them.
 */
export function ColorVarsRow({
  onChange,
  value,
}: {
  onChange: (colour: string) => void;
  value: string;
}) {
  const ctx = useColorVars();
  if (!ctx) {
    return null;
  }
  const current = varFor(value, ctx.vars);
  const alpha = normalHex(value)?.slice(7) ?? "";
  return (
    <div className="color-vars-row">
      <span className="color-vars-row__label">
        Variables{current ? ` · ${current.name}` : ""}
      </span>
      <div className="color-vars-row__swatches">
        {ctx.vars.map((v) => (
          <button
            aria-label={v.name}
            aria-pressed={current?.id === v.id}
            className="color-vars-row__swatch"
            key={v.id}
            onClick={() => onChange(v.value + alpha)}
            style={{ background: v.value }}
            title={v.name}
            type="button"
          />
        ))}
        {current || !normalHex(value) ? null : (
          <button
            aria-label="Save this colour as a variable"
            className="color-vars-row__tool"
            onClick={() => {
              if (ctx.add(value)) {
                ctx.open();
              }
            }}
            title="Save this colour as a variable"
            type="button"
          >
            <Plus size={12} />
          </button>
        )}
        <button
          aria-label="Edit colour variables"
          className="color-vars-row__tool"
          onClick={ctx.open}
          title="Edit colour variables"
          type="button"
        >
          <SlidersHorizontal size={12} />
        </button>
      </div>
    </div>
  );
}
