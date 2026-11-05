import { ArrowRight, Dices, RotateCcw, X } from "lucide-react";
import { ColorWell } from "../ColorWell";
import { ColorsField } from "./ColorsField";
import { colorsOf, paletteFor } from "./chosenColors";
import { replacementsOf } from "./generators/recolour";
import { type FromFrame, ImagePick } from "./ImagePick";
import { LettersField } from "./LettersField";
import { newSeed } from "./rng";
import type { StudioParam, StudioValues } from "./types";

/** One control per setting, drawn from the tool's schema. */
export function StudioControls({
  fromFrame,
  image,
  onChange,
  onImage,
  palette,
  params,
  sources = [],
  values,
}: {
  /** The frame editor's selection, offered as a picture (ImagePick). */
  fromFrame?: FromFrame;
  image: string | null;
  onChange: (key: string, value: boolean | number | string) => void;
  /** A local URL for the picture chosen, and where it came from (ImagePick). */
  onImage: (url: string, source?: string) => void;
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
          case "tiles":
            return null;
          case "text":
            return (
              // biome-ignore lint/a11y/noLabelWithoutControl: the control is inside, a field or a text box
              <label className="studio__field" key={p.key}>
                <span>{p.label}</span>
                {p.multiline ? (
                  <textarea
                    className="studio__input studio__input--lines"
                    maxLength={200}
                    onChange={(e) => onChange(p.key, e.target.value)}
                    rows={Math.min(5, String(v ?? "").split("\n").length + 1)}
                    value={String(v ?? "")}
                  />
                ) : (
                  <input
                    className="studio__input"
                    maxLength={24}
                    onChange={(e) => onChange(p.key, e.target.value)}
                    type="text"
                    value={String(v ?? "")}
                  />
                )}
              </label>
            );
          case "letters":
            return (
              <LettersField
                key={p.key}
                label={p.label}
                onChange={(next) => onChange(p.key, next)}
                start={paletteFor(params, values, palette)}
                text={String(values[p.of] ?? "")}
                value={String(v ?? "")}
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
                fromFrame={fromFrame}
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
