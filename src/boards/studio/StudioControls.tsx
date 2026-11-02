import { ArrowRight, Dices, Plus, RotateCcw, X } from "lucide-react";
import { ColorWell } from "../ColorWell";
import { colorsOf } from "./chosenColors";
import { replacementsOf } from "./generators/recolour";
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
  sources = [],
  values,
}: {
  image: string | null;
  onChange: (key: string, value: boolean | number | string) => void;
  /** A local URL for the picture chosen (ImagePick). */
  onImage: (url: string) => void;
  palette: string[];
  params: StudioParam[];
  /** The colours a "remap" setting lists (the tool's `sources`). */
  sources?: string[];
  values: StudioValues;
}) {
  const shown = params.filter((p) => !p.when || p.when(values));
  return (
    <div className="studio__controls">
      {shown.map((p) => {
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
          case "remap":
            return (
              <RemapField
                key={p.key}
                label={p.label}
                onChange={(next) => onChange(p.key, next)}
                sources={sources}
                value={v}
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

/**
 * Recolour: each of the picture's main colours, and the colour it becomes.
 * Untouched rows keep their colour; the arrow back puts one row, or all of
 * them, back to the picture's own.
 */
function RemapField({
  label,
  onChange,
  sources,
  value,
}: {
  label: string;
  /** The replacements, comma-joined by position. */
  onChange: (next: string) => void;
  sources: string[];
  value: unknown;
}) {
  const swaps = replacementsOf(value, sources.length);
  const save = (i: number, next: string) =>
    onChange(swaps.map((was, j) => (j === i ? next : was)).join(","));
  if (sources.length === 0) {
    return (
      <div className="studio__field">
        <span>{label}</span>
        <small className="studio-pick__empty">
          Choose a picture to see its colours.
        </small>
      </div>
    );
  }
  return (
    <div className="studio__field studio-remap">
      <span>
        {label}
        {swaps.some(Boolean) ? (
          <button
            aria-label="Put every colour back"
            className="studio__icon"
            onClick={() => onChange("")}
            title="Put every colour back"
            type="button"
          >
            <RotateCcw size={13} />
          </button>
        ) : null}
      </span>
      <ul className="studio-remap__list">
        {sources.map((from, i) => (
          <li className="studio-remap__row" key={from}>
            <span
              className="studio-remap__from"
              style={{ background: from }}
              title={from}
            />
            <ArrowRight aria-hidden size={13} />
            <ColorWell
              alpha={false}
              label={`Swap ${from} for`}
              onChange={(next) => save(i, next)}
              value={swaps[i] || from}
            />
            {swaps[i] ? (
              <button
                aria-label={`Keep ${from}`}
                className="studio__icon"
                onClick={() => save(i, "")}
                title="Keep the original colour"
                type="button"
              >
                <X size={12} />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
