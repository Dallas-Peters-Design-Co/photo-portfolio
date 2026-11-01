import { useEffect, useRef, useState } from "react";
import {
  formatOklch,
  hexToOklch,
  isInSrgb,
  type Oklch,
  oklchToHex,
  parseColor,
} from "../../lib/oklch";
import "./OklchPicker.css";

/**
 * The colour picker, in OKLCH.
 *
 * A plane of lightness (up) by chroma (across) at the chosen hue, with the
 * colours sRGB can't show dimmed; a hue strip; an alpha strip when alpha is
 * allowed; a field that takes `oklch(…)` or hex; and the swatches on offer.
 * Hands back hex (gamut-mapped), so every stored colour stays a plain value.
 */

const MAX_C = 0.37;
const PLANE_W = 224;
const PLANE_H = 150;

export interface OklchPickerProps {
  /** Show the alpha strip; when false every colour is opaque. */
  alpha?: boolean;
  onChange: (hex: string) => void;
  swatches?: { color: string; title: string }[];
  value: string;
}

const seed = (value: string): Oklch =>
  hexToOklch(value) ?? { a: 1, c: 0.15, h: 255, l: 0.6 };

function Plane({
  color,
  onPick,
}: {
  color: Oklch;
  onPick: (c: Oklch) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { h } = color;

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) {
      return;
    }
    const image = ctx.createImageData(PLANE_W, PLANE_H);
    for (let y = 0; y < PLANE_H; y += 1) {
      for (let x = 0; x < PLANE_W; x += 1) {
        const c = {
          a: 1,
          c: (x / (PLANE_W - 1)) * MAX_C,
          h,
          l: 1 - y / (PLANE_H - 1),
        };
        const hex = oklchToHex(c);
        const i = (y * PLANE_W + x) * 4;
        image.data[i] = Number.parseInt(hex.slice(1, 3), 16);
        image.data[i + 1] = Number.parseInt(hex.slice(3, 5), 16);
        image.data[i + 2] = Number.parseInt(hex.slice(5, 7), 16);
        // Outside sRGB: shown as its nearest in-gamut colour, faded, so the
        // reachable shape of the hue is visible.
        image.data[i + 3] = isInSrgb(c) ? 255 : 70;
      }
    }
    ctx.putImageData(image, 0, 0);
  }, [h]);

  const pick = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const fx = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width));
    const fy = Math.min(1, Math.max(0, (e.clientY - box.top) / box.height));
    onPick({ ...color, c: fx * MAX_C, l: 1 - fy });
  };

  return (
    <div className="oklch__plane">
      <canvas
        aria-label="Lightness and chroma"
        height={PLANE_H}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          pick(e);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) {
            pick(e);
          }
        }}
        ref={canvas}
        width={PLANE_W}
      />
      <span
        className="oklch__thumb"
        style={{
          left: `${(Math.min(color.c, MAX_C) / MAX_C) * 100}%`,
          top: `${(1 - color.l) * 100}%`,
        }}
      />
    </div>
  );
}

export function OklchPicker({
  alpha = true,
  onChange,
  swatches = [],
  value,
}: OklchPickerProps) {
  // Held locally so dragging hue on a grey (chroma 0) keeps the hue, which
  // hex can't remember.
  const [color, setColor] = useState<Oklch>(() => seed(value));
  const [text, setText] = useState(() => formatOklch(seed(value)));
  const last = useRef(value);

  useEffect(() => {
    if (value !== last.current) {
      last.current = value;
      const next = seed(value);
      setColor((was) => (next.c === 0 ? { ...next, h: was.h } : next));
      setText(formatOklch(next));
    }
  }, [value]);

  const set = (next: Oklch) => {
    const solid = alpha ? next : { ...next, a: 1 };
    setColor(solid);
    setText(formatOklch(solid));
    const hex = oklchToHex(solid);
    last.current = hex;
    onChange(hex);
  };

  const hex = oklchToHex(color);
  const clipped = !isInSrgb(color);

  return (
    <div className="oklch">
      <Plane color={color} onPick={set} />
      <label className="oklch__strip">
        <span>Hue</span>
        <input
          aria-label="Hue"
          className="oklch__range oklch__range--hue"
          max={360}
          min={0}
          onChange={(e) => set({ ...color, h: Number(e.target.value) })}
          step={0.5}
          style={{
            ["--l" as string]: Math.max(color.l, 0.6),
            ["--c" as string]: Math.max(color.c, 0.12),
          }}
          type="range"
          value={color.h}
        />
      </label>
      {alpha ? (
        <label className="oklch__strip">
          <span>Alpha</span>
          <input
            aria-label="Alpha"
            className="oklch__range oklch__range--alpha"
            max={1}
            min={0}
            onChange={(e) => set({ ...color, a: Number(e.target.value) })}
            step={0.01}
            style={{ ["--solid" as string]: hex.slice(0, 7) }}
            type="range"
            value={color.a}
          />
        </label>
      ) : null}
      <div className="oklch__fields">
        <span className="oklch__preview" style={{ background: hex }} />
        <input
          aria-label="OKLCH or hex"
          className="oklch__text"
          onBlur={() => setText(formatOklch(color))}
          onChange={(e) => {
            setText(e.target.value);
            const parsed = parseColor(e.target.value);
            if (parsed) {
              set(parsed);
              setText(e.target.value);
            }
          }}
          spellCheck={false}
          value={text}
        />
      </div>
      <p className="oklch__hex">
        {hex}
        {clipped ? (
          <span title="Outside sRGB; chroma lowered to fit">
            {" "}
            · fitted to sRGB
          </span>
        ) : null}
      </p>
      {swatches.length > 0 ? (
        <div className="oklch__swatches">
          {swatches.map((s) => (
            <button
              aria-label={s.title}
              className="oklch__swatch"
              key={`${s.color}-${s.title}`}
              onClick={() => set(seed(s.color))}
              style={{ background: s.color }}
              title={`${s.title} ${s.color}`}
              type="button"
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
