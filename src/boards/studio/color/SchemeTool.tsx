import {
  Copy,
  Download,
  Link2,
  Lock,
  LockOpen,
  Plus,
  Save,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatOklch, hexToOklch } from "../../../lib/oklch";
import { saveBlob, svgToPngBlob } from "../render";
import { inkOn } from "./harmony";
import { SchemeControls } from "./SchemeControls";
import { SchemeDials } from "./SchemeDials";
import { HueMap } from "./SchemeHueMap";
import { simulate, type Vision } from "./scheme";
import { swatchesSvg } from "./swatches";
import { useKitPalette } from "./useKitPalette";
import { lchOf, useScheme } from "./useScheme";

/**
 * Palette Builder: a palette grown from one colour. Pick the anchor, say what
 * the palette is for (the model), where its other hues sit and how many of
 * them are neutrals. Click any colour to set it by hand with the dials or
 * the hue wheel, sync it back to the anchor, or lock it as it is. Save it as the brand's palette, put it on the board, or copy it
 * out as hex, OKLCH or CSS.
 */

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
  const scheme = useScheme(entries[0]?.value);
  const { anchorAt, colors, locked, selected, settings } = scheme;
  const [vision, setVision] = useState<Vision>("none");

  const nameOf = (i: number) => (i === anchorAt ? "Anchor" : `Colour ${i + 1}`);

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
              data-selected={i === selected ? "" : undefined}
              // biome-ignore lint/suspicious/noArrayIndexKey: a slot is its position
              key={i}
              style={{ background: shown, color: inkOn(shown) }}
            >
              <button
                aria-label={`Edit ${nameOf(i).toLowerCase()}`}
                aria-pressed={i === selected}
                className="studio-palette__pick"
                disabled={!scheme.individual && i !== anchorAt}
                onClick={() => scheme.select(i)}
                title={`${nameOf(i)}: click to set it with the dials`}
                type="button"
              />
              {i === anchorAt ? null : (
                <button
                  aria-label={locked[i] ? `Unlock ${c}` : `Lock ${c}`}
                  aria-pressed={Boolean(locked[i])}
                  className="studio-palette__tool"
                  onClick={() => scheme.toggleLock(i)}
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
              {scheme.held(i) ? (
                <span className="studio-scheme__by-hand">By hand</span>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="studio-scheme">
        <div className="studio__controls">
          <div className="studio-scheme__picked">
            <strong>{nameOf(selected)}</strong>
            <input
              aria-label={`${nameOf(selected)} colour`}
              className="studio-scheme__well"
              onChange={(e) => {
                const { c, h, l } = lchOf(e.target.value);
                scheme.setColour(selected, { c, h, l });
              }}
              type="color"
              value={colors[selected] ?? scheme.anchor}
            />
            {scheme.held(selected) ? (
              <button
                className="studio__button"
                onClick={() => scheme.release(selected)}
                title="This colour follows the anchor and the settings again"
                type="button"
              >
                <Link2 size={14} /> Sync to anchor
              </button>
            ) : null}
            <label className="studio__check studio-scheme__switch">
              <input
                checked={scheme.individual}
                onChange={(e) => scheme.setIndividual(e.target.checked)}
                type="checkbox"
              />
              Individual colours
            </label>
          </div>
          <SchemeDials
            name={nameOf(selected)}
            onChange={(next) => scheme.setColour(selected, next)}
            value={scheme.selectedLch}
          />
          <SchemeControls
            onChange={scheme.setSettings}
            onVision={setVision}
            settings={settings}
            vision={vision}
          />
        </div>
        <HueMap
          handles={colors.map((hex, i) => ({
            // The anchor always turns. Another colour moves when single
            // colours are on and it isn't locked.
            fixed: i !== anchorAt && (!scheme.individual || Boolean(locked[i])),
            held: scheme.held(i),
            hex,
            isAnchor: i === anchorAt,
          }))}
          onHue={(i, h) => {
            scheme.select(i);
            scheme.setColour(i, { h });
          }}
          onRelease={scheme.release}
        />
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
            onClick={scheme.unlockAll}
            type="button"
          >
            Unlock all
          </button>
        ) : null}
      </div>
    </div>
  );
}
