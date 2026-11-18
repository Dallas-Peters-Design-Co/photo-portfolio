import { useState } from "react";
import { PIN_KINDS, PIN_LABELS, type PinKind } from "../../../config/review.js";
import { inkOn } from "../../../config/theme";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { OklchPicker, type OklchPickerProps } from "../ui/OklchPicker";

/**
 * The fill of each kind of review note, in the site settings.
 *
 * Only the fill is chosen. The number and the ring are drawn in black or
 * white, whichever reads on it (inkOn), so the swatch here shows the note
 * exactly as a client will see it, and no fill can make the number vanish.
 */
export function PinColorFields({
  colors,
  swatches,
  labelClass,
  onChange,
}: {
  swatches?: OklchPickerProps["swatches"];
  colors: Record<PinKind, string>;
  labelClass: string;
  onChange: (next: Record<PinKind, string>) => void;
}) {
  const [open, setOpen] = useState<PinKind | null>(null);
  const set = (kind: PinKind, value: string) =>
    onChange({ ...colors, [kind]: value });

  return (
    <div className="space-y-4">
      <h3 className={labelClass}>Review note colors</h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PIN_KINDS.map((kind, i) => {
          const fill = colors[kind];
          const ink = inkOn(fill);
          return (
            <div className="space-y-2" key={kind}>
              <Label htmlFor={`pin-color-${kind}`}>{PIN_LABELS[kind]}</Label>
              <div className="relative flex items-center gap-2">
                {/* The swatch is the note itself: fill, number and ring. */}
                <button
                  aria-expanded={open === kind}
                  aria-label={`Choose the ${PIN_LABELS[kind].toLowerCase()} note color`}
                  className="flex size-11 shrink-0 items-center justify-center rounded-full border-2 font-semibold text-sm tabular-nums"
                  id={`pin-color-${kind}`}
                  onClick={() => setOpen(open === kind ? null : kind)}
                  style={{
                    backgroundColor: fill,
                    borderColor: ink,
                    color: ink,
                  }}
                  type="button"
                >
                  {i + 1}
                </button>
                <Input
                  aria-label={`${PIN_LABELS[kind]} hex value`}
                  face="mono"
                  onChange={(e) => set(kind, e.target.value)}
                  size="lg"
                  spellCheck={false}
                  value={fill}
                />
                {open === kind ? (
                  <>
                    <button
                      aria-label="Close color picker"
                      className="fixed inset-0 z-40 cursor-default"
                      onClick={() => setOpen(null)}
                      type="button"
                    />
                    <div className="absolute top-12 left-0 z-50">
                      <OklchPicker
                        alpha={false}
                        onChange={(hex) => set(kind, hex)}
                        swatches={swatches}
                        value={fill}
                      />
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-sm text-white/70">
        The number and ring turn black or white, whichever reads better on the
        color you pick.
      </p>
    </div>
  );
}
