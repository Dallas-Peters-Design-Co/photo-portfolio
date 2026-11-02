import { Dices, Plus, X } from "lucide-react";
import { ColorWell } from "../ColorWell";
import { colorsOf } from "./chosenColors";
import { ImagePick } from "./ImagePick";
import { newSeed } from "./rng";
import type { StudioParam, StudioValues } from "./types";

/** One control per setting, drawn from the tool's schema. */
export function StudioControls({
  image,
  onChange,
  onImage,
  palette,
  params,
  values,
}: {
  image: string | null;
  onChange: (key: string, value: boolean | number | string) => void;
  /** A local URL for the picture chosen (ImagePick). */
  onImage: (url: string) => void;
  palette: string[];
  params: StudioParam[];
  values: StudioValues;
}) {
  return (
    <div className="studio__controls">
      {params.map((p) => {
        const v = values[p.key];
        switch (p.type) {
          case "range":
            return (
              <label className="studio__field" key={p.key}>
                <span>{p.label}</span>
                <input
                  max={p.max}
                  min={p.min}
                  onChange={(e) => onChange(p.key, Number(e.target.value))}
                  step={p.step ?? 1}
                  type="range"
                  value={Number(v)}
                />
                <output>{Number(v)}</output>
              </label>
            );
          case "select":
            return (
              <label className="studio__field" key={p.key}>
                <span>{p.label}</span>
                <select
                  className="studio__input"
                  onChange={(e) => onChange(p.key, e.target.value)}
                  value={String(v)}
                >
                  {p.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            );
          case "color":
            return (
              <div className="studio__field" key={p.key}>
                <span>{p.label}</span>
                <ColorWell
                  alpha={false}
                  label={p.label}
                  onChange={(c) => onChange(p.key, c)}
                  value={String(
                    v ||
                      (p.key === "bg" ? palette.at(-1) : palette[0]) ||
                      "#000000"
                  )}
                />
              </div>
            );
          case "colors":
            return (
              <ColorsField
                key={p.key}
                label={p.label}
                max={p.max}
                onChange={(next) => onChange(p.key, next)}
                palette={palette}
                value={colorsOf(v, palette, p.count)}
              />
            );
          case "checkbox":
            return (
              <label className="studio__check" key={p.key}>
                <input
                  checked={Boolean(v)}
                  onChange={(e) => onChange(p.key, e.target.checked)}
                  type="checkbox"
                />
                {p.label}
              </label>
            );
          case "seed":
            return (
              <div className="studio__field" key={p.key}>
                <span>{p.label}</span>
                <input
                  className="studio__input studio__input--num"
                  onChange={(e) => onChange(p.key, Number(e.target.value) || 1)}
                  type="number"
                  value={Number(v)}
                />
                <button
                  aria-label="New seed"
                  className="studio__icon"
                  onClick={() => onChange(p.key, newSeed())}
                  title="New variation"
                  type="button"
                >
                  <Dices size={15} />
                </button>
              </div>
            );
          default:
            return (
              <ImagePick
                current={image}
                key={p.key}
                label={p.label}
                onPick={onImage}
              />
            );
        }
      })}
    </div>
  );
}

/** A row of colour wells, one per colour the tool draws with. */
function ColorsField({
  label,
  max,
  onChange,
  palette,
  value,
}: {
  label: string;
  max: number;
  /** The colours, comma-joined. */
  onChange: (next: string) => void;
  palette: string[];
  value: string[];
}) {
  const save = (next: string[]) => onChange(next.join(","));
  return (
    <div className="studio__field studio-colors">
      <span>{label}</span>
      <div className="studio-colors__row">
        {value.map((c, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a colour's place is its identity; two can be the same colour
          <span className="studio-colors__well" key={i}>
            <ColorWell
              alpha={false}
              label={`${label} ${i + 1}`}
              onChange={(next) =>
                save(value.map((was, j) => (j === i ? next : was)))
              }
              value={c}
            />
            {value.length > 2 ? (
              <button
                aria-label={`Remove colour ${i + 1}`}
                className="studio-colors__remove"
                onClick={() => save(value.filter((_, j) => j !== i))}
                type="button"
              >
                <X size={10} />
              </button>
            ) : null}
          </span>
        ))}
        {value.length < max ? (
          <button
            aria-label="Add a colour"
            className="studio__icon"
            onClick={() =>
              save([
                ...value,
                palette[value.length % palette.length] ?? "#000000",
              ])
            }
            title="Add a colour"
            type="button"
          >
            <Plus size={14} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
