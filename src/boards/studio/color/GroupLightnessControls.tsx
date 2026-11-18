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
              end === "min" ? "Minimum lightness" : "Maximum lightness";
            const percent = Math.round(ramp[end] * 100);
            return (
              <label className="studio__field" key={end}>
                <span>
                  {label} · {percent}%
                </span>
                <input
                  aria-label={label}
                  max={end === "max" ? 100 : Math.round(ramp.max * 100)}
                  min={end === "min" ? 0 : Math.round(ramp.min * 100)}
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
            {group} runs from dark to light in bar order. Moving its hue shifts
            every shade.
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
