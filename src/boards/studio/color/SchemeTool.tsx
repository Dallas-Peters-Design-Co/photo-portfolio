import { Copy, Download, Lock, LockOpen, Plus, Save } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { formatOklch, hexToOklch } from "../../../lib/oklch";
import { saveBlob, svgToPngBlob } from "../render";
import { inkOn } from "./harmony";
import { SchemeControls } from "./SchemeControls";
import { HueMap } from "./SchemeHueMap";
import {
  buildScheme,
  SCHEME_DEFAULTS,
  type SchemeOptions,
  simulate,
  type Vision,
} from "./scheme";
import { swatchesSvg } from "./swatches";
import { useKitPalette } from "./useKitPalette";

/**
 * Palette Builder: a palette grown from one colour. Pick the anchor, say what
 * the palette is for (the model), where its other hues sit and how many of
 * them are neutrals; lock any colour worth keeping and change the rest
 * around it. Save it as the brand's palette, put it on the board, or copy it
 * out as hex, OKLCH or CSS.
 */

type Settings = Omit<SchemeOptions, "anchor" | "locked">;

const oklchOf = (hex: string) => {
  const c = hexToOklch(hex);
  return c ? formatOklch(c) : hex;
};

const cssOf = (colors: string[]) =>
  `:root {\n${colors
    .map((c, i) => `  --color-${i + 1}: ${oklchOf(c)}; /* ${c} */`)
    .join("\n")}\n}`;

export function SchemeTool({ onAdd }: { onAdd: (file: File) => void }) {
  const { entries, kit, save, saving } = useKitPalette();
  const [anchor, setAnchor] = useState(entries[0]?.value ?? "#2f7cf6");
  const [settings, setSettings] = useState<Settings>(SCHEME_DEFAULTS);
  // Colours held as they are, by position (the anchor is never in here).
  const [locked, setLocked] = useState<(string | null)[]>([]);
  const [vision, setVision] = useState<Vision>("none");

  const colors = useMemo(
    () => buildScheme({ ...settings, anchor, locked }),
    [anchor, locked, settings]
  );

  // Where the anchor sits: first, except in a ramp, where it takes the step
  // nearest its own lightness.
  const anchorAt = Math.max(0, colors.indexOf(anchor.toLowerCase()));

  const toggleLock = (i: number) =>
    setLocked((was) => {
      const next = [...was];
      next[i] = next[i] ? null : (colors[i] ?? null);
      return next;
    });

  const copy = (text: string, what: string) => {
    void navigator.clipboard?.writeText(text);
    toast.success(`${what} copied`);
  };

  const add = async () => {
    const { h, svg, w } = swatchesSvg([{ colors }]);
    const png = await svgToPngBlob(svg, w, h);
    onAdd(new File([png], "palette.png", { type: "image/png" }));
    toast.success("Palette added to the board");
  };

  return (
    <div className="studio-palette-tool">
      <div className="studio-palette">
        {colors.map((c, i) => {
          const shown = simulate(c, vision);
          return (
            <div
              className="studio-palette__swatch"
              // biome-ignore lint/suspicious/noArrayIndexKey: a slot is its position
              key={i}
              style={{ background: shown, color: inkOn(shown) }}
            >
              {i === anchorAt ? (
                <input
                  aria-label="Anchor colour"
                  className="studio-palette__well"
                  onChange={(e) => setAnchor(e.target.value)}
                  title="The anchor: every other colour is made from it"
                  type="color"
                  value={anchor}
                />
              ) : (
                <button
                  aria-label={locked[i] ? `Unlock ${c}` : `Lock ${c}`}
                  aria-pressed={Boolean(locked[i])}
                  className="studio-palette__tool"
                  onClick={() => toggleLock(i)}
                  type="button"
                >
                  {locked[i] ? <Lock size={15} /> : <LockOpen size={15} />}
                </button>
              )}
              <button
                className="studio-palette__hex"
                onClick={() => copy(c, c)}
                title={oklchOf(c)}
                type="button"
              >
                {c.slice(1).toUpperCase()}
              </button>
              {i === anchorAt ? (
                <span className="studio-scheme__anchor">Anchor</span>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="studio-scheme">
        <SchemeControls
          onChange={(next) => setSettings((was) => ({ ...was, ...next }))}
          onVision={setVision}
          settings={settings}
          vision={vision}
        />
        <HueMap colors={colors} />
      </div>
      <div className="studio__actions">
        {kit ? (
          <button
            className="studio__button studio__button--primary"
            disabled={saving}
            onClick={() => void save(colors)}
            title="Saves a new version of the kit; the old palette stays in its history"
            type="button"
          >
            <Save size={14} /> Save to {kit.name}
          </button>
        ) : null}
        <button
          className="studio__button"
          onClick={() => void add()}
          type="button"
        >
          <Plus size={14} /> Add to board
        </button>
        <button
          className="studio__button"
          onClick={() => copy(colors.join(", "), "Hex values")}
          type="button"
        >
          <Copy size={14} /> Hex
        </button>
        <button
          className="studio__button"
          onClick={() => copy(colors.map(oklchOf).join("\n"), "OKLCH values")}
          type="button"
        >
          <Copy size={14} /> OKLCH
        </button>
        <button
          className="studio__button"
          onClick={() => copy(cssOf(colors), "CSS")}
          type="button"
        >
          <Copy size={14} /> CSS
        </button>
        <button
          className="studio__button"
          onClick={() =>
            saveBlob(
              new Blob([swatchesSvg([{ colors }]).svg], {
                type: "image/svg+xml",
              }),
              "palette.svg"
            )
          }
          type="button"
        >
          <Download size={14} /> SVG
        </button>
        {locked.some(Boolean) ? (
          <button
            className="studio__button"
            onClick={() => setLocked([])}
            type="button"
          >
            Unlock all
          </button>
        ) : null}
      </div>
    </div>
  );
}
