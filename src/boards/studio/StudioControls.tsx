import { Dices } from "lucide-react";
import { ColorWell } from "../ColorWell";
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
