import type { TextStyle } from "../../../config/textStyle";
import { ColorWell } from "../ColorWell";

/**
 * The outline around text and the box behind it, for the frame editor's
 * context bar. Each starts with a toggle, so turning one on gives a sensible
 * look straight away: a thin dark outline, or a box in the brand's first
 * colour with a little padding. Widths and padding are in em, so they keep
 * their proportion when the text is resized.
 */

const num = (value: string, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export function TextEffects({
  accent,
  onSet,
  style,
}: {
  /** The colour a new box behind the text starts in. */
  accent: string;
  onSet: (next: Partial<TextStyle>) => void;
  style: TextStyle | null;
}) {
  const outlined = Boolean(style?.outline && style.outlineWidth);
  const boxed = Boolean(style?.background);
  return (
    <>
      <button
        aria-pressed={outlined}
        className="creative__icon"
        onClick={() =>
          onSet(
            outlined
              ? { outline: null, outlineWidth: null }
              : { outline: "#000000", outlineWidth: 0.03 }
          )
        }
        title={outlined ? "Remove the outline" : "Outline the text"}
        type="button"
      >
        Outline
      </button>
      {outlined ? (
        <>
          <ColorWell
            label="Outline colour"
            onChange={(outline) => onSet({ outline })}
            value={style?.outline ?? "#000000"}
          />
          <input
            aria-label="Outline thickness"
            className="creative__range"
            max={200}
            min={5}
            onChange={(e) =>
              onSet({ outlineWidth: num(e.target.value, 30) / 1000 })
            }
            step={5}
            type="range"
            value={Math.round((style?.outlineWidth ?? 0.03) * 1000)}
          />
        </>
      ) : null}
      <button
        aria-pressed={boxed}
        className="creative__icon"
        onClick={() =>
          onSet(
            boxed
              ? {
                  background: null,
                  backgroundPadding: null,
                  backgroundRadius: null,
                }
              : {
                  background: accent,
                  backgroundPadding: 0.3,
                  backgroundRadius: 0.2,
                }
          )
        }
        title={
          boxed ? "Remove the box behind the text" : "Put a box behind the text"
        }
        type="button"
      >
        Box
      </button>
      {boxed ? (
        <>
          <ColorWell
            label="Box colour"
            onChange={(background) => onSet({ background })}
            value={style?.background ?? accent}
          />
          <input
            aria-label="Box padding"
            className="creative__range"
            max={200}
            min={0}
            onChange={(e) =>
              onSet({ backgroundPadding: num(e.target.value, 30) / 100 })
            }
            step={5}
            title="Padding"
            type="range"
            value={Math.round((style?.backgroundPadding ?? 0) * 100)}
          />
          <input
            aria-label="Box corners"
            className="creative__range"
            max={200}
            min={0}
            onChange={(e) =>
              onSet({ backgroundRadius: num(e.target.value, 20) / 100 })
            }
            step={5}
            title="Corners"
            type="range"
            value={Math.round((style?.backgroundRadius ?? 0) * 100)}
          />
        </>
      ) : null}
    </>
  );
}
