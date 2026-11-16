import { useEffect } from "react";
import { fontRefId } from "../../../config/fontRef.js";
import { FONT_CHOICES, type FontChoice } from "../../../config/theme.js";
import { loadFont } from "../../theme/fonts";

/** The weights an app font has, in hundreds, for the kit to record. */
const weightsOf = (font: FontChoice): number[] => {
  const weights: number[] = [];
  for (let w = font.weight.min; w <= font.weight.max; w += 100) {
    weights.push(w);
  }
  return weights;
};

/**
 * The app's own typefaces (Exposure and the rest, self-hosted), to add to a
 * brand kit beside Google, Fontshare and Adobe faces. Each name is drawn in
 * its own face.
 */
export function AppFontList({
  onAdd,
  taken,
}: {
  onAdd: (font: FontChoice, weights: number[]) => void;
  taken: Set<string>;
}) {
  useEffect(() => {
    for (const font of FONT_CHOICES) {
      void loadFont(font.id);
    }
  }, []);
  return (
    <ul className="brand-fonts__results">
      {FONT_CHOICES.map((font) => {
        const added = taken.has(
          fontRefId({
            family: font.label,
            fontId: font.id,
            kitId: null,
            source: "app",
          })
        );
        const weights = weightsOf(font);
        return (
          <li key={font.id}>
            <button
              className="brand-fonts__result"
              disabled={added}
              onClick={() => onAdd(font, weights)}
              type="button"
            >
              <span
                className="brand-fonts__name"
                style={{ fontFamily: font.stack }}
              >
                {font.label}
              </span>
              <span className="brand-fonts__meta">
                {added
                  ? "Added"
                  : `+ Add · ${weights.length} weight${weights.length === 1 ? "" : "s"}`}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
