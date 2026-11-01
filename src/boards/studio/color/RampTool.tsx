import { Check, Copy, Download, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { saveBlob, svgToPngBlob } from "../render";
import { type Ramp, rampOf, rampsCss, rampsJson, STEPS, slug } from "./ramp";
import { swatchesSvg } from "./swatches";

/**
 * Color Ramps: every brand colour as a 50–950 scale, to copy into code as CSS
 * variables, a Tailwind theme or JSON, or to put on the board as a chart.
 */

interface Base {
  name: string;
  value: string;
}

const uniqueNames = (bases: Base[]) => {
  const seen = new Map<string, number>();
  return bases.map((b, i) => {
    const name = slug(b.name, `color-${i + 1}`);
    const n = (seen.get(name) ?? 0) + 1;
    seen.set(name, n);
    return n > 1 ? `${name}-${n}` : name;
  });
};

function CopyButton({ label, text }: { label: string; text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="studio__button"
      onClick={() => {
        void navigator.clipboard?.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      type="button"
    >
      {done ? <Check size={14} /> : <Copy size={14} />} {label}
    </button>
  );
}

export function RampTool({
  onAdd,
  palette,
}: {
  onAdd: (file: File) => void;
  palette: Base[];
}) {
  const [hueShift, setHueShift] = useState(0);
  const [saturation, setSaturation] = useState(1);
  const [extra, setExtra] = useState<string[]>([]);
  const [off, setOff] = useState<Set<number>>(new Set());
  const [pick, setPick] = useState("#3d7bfd");

  const bases = useMemo(
    () => [...palette, ...extra.map((value) => ({ name: "", value }))],
    [palette, extra]
  );
  const names = uniqueNames(bases);
  const ramps = bases
    .map((b, i) =>
      off.has(i)
        ? null
        : rampOf(b.value, names[i] ?? `color-${i + 1}`, {
            hueShift,
            saturation,
          })
    )
    .filter((r): r is Ramp => r !== null);

  const chart = () =>
    swatchesSvg(
      ramps.map((r) => ({ colors: r.colors, label: r.name, steps: [...STEPS] }))
    );

  const add = async () => {
    const { h, svg, w } = chart();
    const png = await svgToPngBlob(svg, w, h);
    onAdd(new File([png], "color-ramps.png", { type: "image/png" }));
    toast.success("Color ramps added to the board");
  };

  const toggle = (i: number) =>
    setOff((was) => {
      const next = new Set(was);
      if (next.has(i)) {
        next.delete(i);
      } else {
        next.add(i);
      }
      return next;
    });

  return (
    <>
      <div className="studio-ramps">
        {bases.map((b, i) => {
          const ramp = off.has(i)
            ? null
            : ramps.find((r) => r.name === names[i]);
          return (
            <div className="studio-ramps__row" key={`${b.value}-${names[i]}`}>
              <label className="studio-ramps__name">
                <input
                  checked={!off.has(i)}
                  onChange={() => toggle(i)}
                  type="checkbox"
                />
                {names[i]}
              </label>
              {ramp ? (
                <div className="studio-ramps__chips">
                  {ramp.colors.map((c, ci) => (
                    <button
                      aria-label={`${names[i]} ${STEPS[ci]} ${c}, copy`}
                      className={
                        ci === ramp.baseIndex
                          ? "studio-ramps__chip studio-ramps__chip--base"
                          : "studio-ramps__chip"
                      }
                      key={STEPS[ci]}
                      onClick={() => {
                        void navigator.clipboard?.writeText(c);
                        toast.success(`${c} copied`);
                      }}
                      style={{ background: c }}
                      title={`${STEPS[ci]} ${c}`}
                      type="button"
                    />
                  ))}
                </div>
              ) : (
                <span className="studio__blurb">Left out</span>
              )}
              {i >= palette.length ? (
                <button
                  aria-label={`Remove ${names[i]}`}
                  className="studio__icon"
                  onClick={() =>
                    setExtra((was) =>
                      was.filter((_, k) => k !== i - palette.length)
                    )
                  }
                  type="button"
                >
                  <X size={14} />
                </button>
              ) : null}
            </div>
          );
        })}
        <div aria-hidden className="studio-ramps__row">
          <span />
          <div className="studio-ramps__chips studio-ramps__chips--steps">
            {STEPS.map((s) => (
              <span key={s}>{s}</span>
            ))}
          </div>
        </div>
      </div>
      <p className="studio__blurb">
        Tints and shades of each colour at shared OKLCH lightness steps, so a
        300 is as light in every ramp. The outlined chip is the colour itself.
        Click a chip to copy it.
      </p>
      <div className="studio__controls">
        <label className="studio__field">
          <span>Hue shift</span>
          <input
            max={30}
            min={-30}
            onChange={(e) => setHueShift(Number(e.target.value))}
            type="range"
            value={hueShift}
          />
          <output>{hueShift}°</output>
        </label>
        <label className="studio__field">
          <span>Saturation</span>
          <input
            max={2}
            min={0}
            onChange={(e) => setSaturation(Number(e.target.value))}
            step={0.05}
            type="range"
            value={saturation}
          />
          <output>{Math.round(saturation * 100)}%</output>
        </label>
        <div className="studio__field">
          <span>Another colour</span>
          <input
            aria-label="Colour to add"
            className="studio-ramps__pick"
            onChange={(e) => setPick(e.target.value)}
            type="color"
            value={pick}
          />
          <button
            className="studio__button"
            onClick={() => setExtra((was) => [...was, pick])}
            type="button"
          >
            <Plus size={14} /> Add
          </button>
        </div>
      </div>
      <div className="studio__actions">
        <button
          className="studio__button studio__button--primary"
          disabled={ramps.length === 0}
          onClick={() => void add()}
          type="button"
        >
          <Plus size={14} /> Add to board
        </button>
        <CopyButton label="CSS" text={rampsCss(ramps, "root")} />
        <CopyButton label="Tailwind" text={rampsCss(ramps, "theme")} />
        <CopyButton label="JSON" text={rampsJson(ramps)} />
        <button
          className="studio__button"
          onClick={() => {
            const { svg } = chart();
            saveBlob(
              new Blob([svg], { type: "image/svg+xml" }),
              "color-ramps.svg"
            );
          }}
          type="button"
        >
          <Download size={14} /> SVG
        </button>
      </div>
    </>
  );
}
