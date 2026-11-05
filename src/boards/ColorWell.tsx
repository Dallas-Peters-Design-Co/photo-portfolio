import { HugeiconsIcon } from "@hugeicons/react";
import ColorPickerIcon from "@hugeicons-pro/core-stroke-standard/ColorPickerIcon";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** The picker's own size, used only to keep it on screen. */
const PICKER_WIDTH = 240;
const PICKER_HEIGHT = 420;

import { OklchPicker } from "../components/ui/OklchPicker";
import { useBrandSwatches } from "./brand/ActiveBrand";
import { ColorVarsRow } from "./colorVars/ColorVarsRow";
import { varFor } from "./colorVars/colorVars";
import { useColorVars } from "./colorVars/useColorVars";
import { isTransparent } from "./drawing/drawing";
import "./ColorWell.css";

/**
 * A color swatch that opens the project's OKLCH picker.
 *
 * The same arrangement the site settings panel uses — swatch, a full-screen
 * button behind the popover to catch the dismissing click, picker above it —
 * because two color pickers behaving differently in one product is worse than
 * either behaviour on its own.
 *
 * Alpha is enabled here, unlike in site settings. There it is disabled because
 * the contrast checker returns zero for anything that is not a plain hex, so a
 * translucent value would silently switch off the WCAG warning. Nothing here
 * measures contrast, and a translucent mark over a photograph — a highlight
 * rather than a blackout — is one of the main things drawing on a board is for.
 */

interface ColorWellProps {
  /** Offer alpha; false for values stored as plain six-digit hex. */
  alpha?: boolean;
  label: string;
  /** Leave out the board's colour variables (a variable's own well). */
  noVars?: boolean;
  onChange: (color: string) => void;
  value: string;
}

/**
 * `#rrggbb`, or `#rrggbbaa` when it is not fully opaque.
 *
 * The alpha pair is dropped at full opacity so ordinary colors stay in the
 * familiar six-digit form, and carried whenever it would otherwise be lost.
 */
export const pickerSeed = (value: string): string =>
  isTransparent(value) ? "#ffffff" : value;

export function ColorWell({
  alpha = true,
  label,
  noVars = false,
  onChange,
  value,
}: ColorWellProps) {
  const vars = useColorVars();
  const linked = noVars || !vars ? null : varFor(value, vars.vars);
  const [at, setAt] = useState<{ left: number; top: number } | null>(null);
  // The board's brand colours replace the picker's stock presets, so the
  // palette is one click away wherever a colour is chosen.
  const brandSwatches = useBrandSwatches();
  const clear = isTransparent(value);
  const canSample = typeof window !== "undefined" && "EyeDropper" in window;

  /**
   * Hands the pointer back to the operating system while the picker is open.
   *
   * The board draws its own cursor and hides the real one, which is fine for
   * dragging things about and useless for choosing a color off a gradient —
   * the drawn arrow and its name label cover the pixel being aimed at. While a
   * picker is open there is nothing else to interact with, so the swap is safe
   * for exactly as long as it is needed.
   */
  useEffect(() => {
    if (!at) {
      return;
    }
    document.body.classList.add("cursor-precise");
    return () => document.body.classList.remove("cursor-precise");
  }, [at]);

  /**
   * Opens the picker at the swatch, in viewport coordinates.
   *
   * The position is read from the swatch and the picker is rendered into the
   * document body, because an absolutely-positioned popover is clipped by any
   * scrolling ancestor — and a node's body scrolls, so on a Palette node the
   * picker would have opened inside a box too short to show it.
   */
  const open = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (at) {
      setAt(null);
      return;
    }
    const box = e.currentTarget.getBoundingClientRect();
    // Below the swatch, unless that would run off the bottom of the window.
    const wantsAbove = box.bottom + PICKER_HEIGHT > window.innerHeight;
    setAt({
      left: Math.min(box.left, window.innerWidth - PICKER_WIDTH - 8),
      top: wantsAbove ? box.top - PICKER_HEIGHT - 8 : box.bottom + 8,
    });
  };

  /**
   * Samples a color from anywhere on screen.
   *
   * The picker stays open behind it: sampling is usually the first move and
   * nudging the result on the gradient is the second, so closing here would
   * make the common pair into two trips.
   */
  const sample = async () => {
    const Sampler = window.EyeDropper;
    if (!Sampler) {
      return;
    }
    try {
      const picked = await new Sampler().open();
      onChange(picked.sRGBHex);
    } catch {
      // Dismissed with Escape, which is a choice rather than a failure.
    }
  };

  return (
    <div className="color-well">
      <button
        aria-label={label}
        className="color-well__swatch"
        data-var={linked ? "" : undefined}
        onClick={open}
        onPointerDown={(e) => e.stopPropagation()}
        title={linked ? `${label} · ${linked.name}` : label}
        type="button"
      >
        {/* A chequerboard under the swatch, so a transparent or translucent
            color reads as see-through rather than as black. */}
        <span
          className="color-well__fill"
          style={{
            backgroundColor: clear ? "transparent" : value,
            backgroundImage: clear
              ? "linear-gradient(45deg,#666 25%,transparent 25%,transparent 75%,#666 75%),linear-gradient(45deg,#666 25%,transparent 25%,transparent 75%,#666 75%)"
              : undefined,
            backgroundPosition: "0 0, 4px 4px",
            backgroundSize: "8px 8px",
          }}
        />
      </button>

      {at
        ? createPortal(
            <>
              {/* Catches the click that dismisses the picker. Sits under it,
                  over everything else. */}
              <button
                aria-label={`Close ${label}`}
                className="color-well__scrim"
                onClick={() => setAt(null)}
                type="button"
              />
              <div
                className="color-well__picker"
                onPointerDown={(e) => e.stopPropagation()}
                style={{ left: at.left, top: at.top }}
              >
                <OklchPicker
                  alpha={alpha}
                  onChange={onChange}
                  swatches={brandSwatches}
                  value={pickerSeed(value)}
                />
                {/* Sampling beats matching by eye when the color wanted is
                    already on the board — a reference photograph, a logo, an
                    image just generated. Absent rather than disabled where the
                    browser has no sampler: a control that cannot work is worse
                    than one that is not offered. */}
                {noVars ? null : (
                  <ColorVarsRow onChange={onChange} value={value} />
                )}
                {canSample ? (
                  <button
                    className="color-well__sample"
                    onClick={() => void sample()}
                    type="button"
                  >
                    <HugeiconsIcon icon={ColorPickerIcon} size={12} />
                    Pick from screen
                  </button>
                ) : null}
              </div>
            </>,
            document.body
          )
        : null}
    </div>
  );
}
