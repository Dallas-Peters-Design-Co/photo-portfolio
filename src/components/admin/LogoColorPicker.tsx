import { HugeiconsIcon } from "@hugeicons/react";
import Cancel01Icon from "@hugeicons-pro/core-stroke-standard/Cancel01Icon";
import PlusSignIcon from "@hugeicons-pro/core-stroke-standard/PlusSignIcon";
import type { BrandKit } from "../../services/brandKitService";

/**
 * The colours for a new logo board: picked swatches, or the kit's.
 *
 * Native colour inputs dressed as swatches, the same control the brand kit
 * editor uses, so picking a colour here feels like picking one there. With a
 * kit chosen the swatches become read-only: the Brand node carries the kit's
 * palette exactly, and a second set picked here would only compete with it.
 */

/** Enough to constrain a mark; a logo with more colours than this is rare. */
export const MAX_LOGO_COLORS = 5;

/**
 * What a new swatch starts as: the next of these not already picked.
 *
 * Visible on the dialog's black, and different from each other, so adding two
 * swatches shows two colours to change rather than two identical dark squares.
 */
const STARTERS = ["#1f4d2b", "#f5efe0", "#c8553d", "#2b4c7e", "#e9b44c"];

const nextSwatch = (colors: string[]): string =>
  STARTERS.find((c) => !colors.includes(c)) ?? STARTERS[0];

export function LogoColorPicker({
  colors,
  kit,
  onChange,
}: {
  colors: string[];
  /** The chosen kit, when there is one. */
  kit: BrandKit | null;
  onChange: (next: string[]) => void;
}) {
  if (kit) {
    const { palette } = kit.resolvedDoc;
    return (
      <div className="logo-colors">
        {palette.length > 0 ? (
          <ul className="logo-colors__list">
            {palette.map((entry, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: two palette entries may share a value; position is the identity
              <li className="logo-colors__item" key={`kit-${index}`}>
                <span
                  className="logo-colors__swatch logo-colors__swatch--fixed"
                  style={{ background: entry.value }}
                  title={entry.name || entry.value}
                />
                <span className="logo-colors__hex">{entry.value}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="admin-note">
          {palette.length > 0
            ? `From ${kit.name}. Edit them in Brand kits.`
            : `${kit.name} has no colours yet. Add them in Brand kits.`}
        </p>
      </div>
    );
  }

  const set = (index: number, value: string) =>
    onChange(colors.map((c, i) => (i === index ? value : c)));

  return (
    <div className="logo-colors">
      <ul className="logo-colors__list">
        {colors.map((color, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a swatch has no identity but its place — two may share a colour
          <li className="logo-colors__item" key={`color-${index}`}>
            <input
              aria-label={`Colour ${index + 1}`}
              className="logo-colors__swatch"
              name={`color-${index}`}
              onChange={(e) => set(index, e.target.value)}
              type="color"
              value={color}
            />
            <span className="logo-colors__hex">{color}</span>
            <button
              aria-label={`Remove colour ${index + 1}`}
              className="logo-colors__remove"
              onClick={() => onChange(colors.filter((_, i) => i !== index))}
              type="button"
            >
              <HugeiconsIcon aria-hidden icon={Cancel01Icon} size={10} />
            </button>
          </li>
        ))}
        {colors.length < MAX_LOGO_COLORS ? (
          <li className="logo-colors__item">
            <button
              aria-label="Add a colour"
              className="logo-colors__swatch logo-colors__add"
              onClick={() => onChange([...colors, nextSwatch(colors)])}
              type="button"
            >
              <HugeiconsIcon aria-hidden icon={PlusSignIcon} size={14} />
            </button>
            <span className="logo-colors__hex logo-colors__hex--quiet">
              {colors.length === 0 ? "Any" : "Add"}
            </span>
          </li>
        ) : null}
      </ul>
    </div>
  );
}
