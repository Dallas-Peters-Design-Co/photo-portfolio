import type { CSSProperties } from "react";

/**
 * The anchor as three dials: lightness, chroma and hue, each on a track
 * painted with what moving along it gives, the other two held where they
 * are. Kept as numbers, not read back from the hex, so a grey remembers its
 * hue and turning the chroma back up brings the same colour back.
 */

export interface Lch {
  c: number;
  h: number;
  l: number;
}

const css = ({ c, h, l }: Lch) => `oklch(${l} ${c} ${h})`;

const track = (stops: Lch[]): CSSProperties => ({
  background: `linear-gradient(to right in oklch, ${stops.map(css).join(", ")})`,
});

const round = (v: number, places: number) => {
  const f = 10 ** places;
  return Math.round(v * f) / f;
};

const DIALS = [
  {
    key: "l",
    label: "Lightness",
    max: 100,
    places: 1,
    scale: 100,
    step: 0.1,
    stops: (v: Lch) => [0, 0.25, 0.5, 0.75, 1].map((l) => ({ ...v, l })),
  },
  {
    key: "c",
    label: "Chroma",
    max: 0.4,
    places: 3,
    scale: 1,
    step: 0.001,
    stops: (v: Lch) => [0, 0.1, 0.2, 0.3, 0.4].map((c) => ({ ...v, c })),
  },
  {
    key: "h",
    label: "Hue",
    max: 360,
    places: 1,
    scale: 1,
    step: 0.5,
    stops: (v: Lch) =>
      Array.from({ length: 13 }, (_, i) => ({ ...v, h: i * 30 })),
  },
] as const;

export function SchemeDials({
  onChange,
  value,
}: {
  onChange: (next: Lch) => void;
  value: Lch;
}) {
  return (
    <div className="studio-dials">
      {DIALS.map((dial) => {
        const shown = round(value[dial.key] * dial.scale, dial.places);
        return (
          <label className="studio-dials__dial" key={dial.key}>
            <span className="studio-dials__name">
              <strong>{dial.key.toUpperCase()}</strong> {dial.label}
            </span>
            <output>{shown.toFixed(dial.places)}</output>
            <input
              aria-label={`Anchor ${dial.label.toLowerCase()}`}
              className="studio-dials__track"
              max={dial.max}
              min={0}
              onChange={(e) =>
                onChange({
                  ...value,
                  [dial.key]: Number(e.target.value) / dial.scale,
                })
              }
              step={dial.step}
              style={track(dial.stops(value))}
              type="range"
              value={shown}
            />
          </label>
        );
      })}
    </div>
  );
}
