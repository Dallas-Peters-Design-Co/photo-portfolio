import type { LightnessRamp } from "../../../../config/brandKit.js";
import type { Lch } from "./SchemeDials";

export function GroupLightnessControls({
  group,
  color,
  ramp,
  onChange,
  onAddShade,
  canAddShade,
}: {
  group: string;
  onAddShade: () => void;
  canAddShade: boolean;
  color: Lch;
  ramp?: LightnessRamp;
  onChange: (next: LightnessRamp | undefined) => void;
}) {
  return (
    <>
      <label className="studio__check">
        <input
          checked={Boolean(ramp)}
          onChange={(event) =>
            onChange(
              event.target.checked
                ? { c: color.c, h: color.h, max: 0.9, min: 0.2 }
                : undefined
            )
          }
          type="checkbox"
        />
        Same-hue lightness ramp
      </label>
      {ramp ? (
        <>
          {(["min", "max"] as const).map((end) => {
            const label =
              end === "min"
                ? "First swatch lightness"
                : "Last swatch lightness";
            const percent = Math.round(ramp[end] * 100);
            return (
              <label className="studio__field" key={end}>
                <span>
                  {label} · {percent}%
                </span>
                <input
                  aria-label={label}
                  max={100}
                  min={0}
                  onChange={(event) =>
                    onChange({
                      ...ramp,
                      [end]: event.currentTarget.valueAsNumber / 100,
                    })
                  }
                  type="range"
                  value={percent}
                />
              </label>
            );
          })}
          <button
            className="studio__button"
            disabled={!canAddShade}
            onClick={onAddShade}
            type="button"
          >
            Add shade
          </button>
          <span>
            {group} interpolates evenly from the first swatch to the last in bar
            order. Moving its hue shifts every shade.
          </span>
        </>
      ) : (
        <span>
          Lightness and chroma are shared with {group}. Drag a wheel handle to
          change its hue.
        </span>
      )}
    </>
  );
}
