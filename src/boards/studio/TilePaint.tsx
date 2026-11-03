import { Brush, Eraser, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ColorWell } from "../ColorWell";
import {
  paintedOf,
  paintedText,
  tileAt,
  tileKey,
} from "./generators/paintedTiles";
import type { StudioValues } from "./types";

/**
 * Colouring single mosaic tiles by hand, on the preview.
 *
 * Turn on Paint, pick a colour (transparency included; fully clear hides the
 * tile), then click or drag across tiles. ⌥/Alt-drag, or the eraser, puts
 * tiles back to the colour the mosaic gives them.
 */

interface Size {
  h: number;
  w: number;
}

export const usePaintTiles = ({
  keyName,
  onChange,
  size,
  values,
}: {
  /** The setting the paint is kept in; null when the tool has none. */
  keyName: string | null;
  onChange: (key: string, value: string) => void;
  size: Size;
  values: StudioValues;
}) => {
  const [on, setOn] = useState(false);
  const [erase, setErase] = useState(false);
  const [brush, setBrush] = useState("#000000");
  const layer = useRef<HTMLCanvasElement | null>(null);
  /**
   * The stroke in progress. Painting is drawn straight onto a canvas over the
   * preview as the pointer moves, and the mosaic itself is rebuilt once, when
   * the stroke ends: rebuilding a mosaic of thousands of tiles for every tile
   * crossed is what made the brush lag behind the mouse.
   */
  const stroke = useRef<{
    box: { h: number; k: number; x: number; y: number; w: number };
    last: { col: number; row: number } | null;
    painted: Map<string, string>;
  } | null>(null);

  const geometry = () => {
    const cols = Math.max(2, Number(values.columns) || 48);
    const cell = size.w / cols;
    return {
      cell,
      cols,
      inset: cell * ((Number(values.gap) || 0) / 100),
      rows: Math.max(1, Math.round(size.h / cell)),
    };
  };

  /** Where the picture is drawn inside the preview box, in CSS pixels. */
  const fit = (box: HTMLElement) => {
    const img = box.querySelector("img");
    const outer = box.getBoundingClientRect();
    const rect = img ? img.getBoundingClientRect() : outer;
    const k = Math.min(rect.width / size.w, rect.height / size.h);
    return {
      h: size.h * k,
      k,
      w: size.w * k,
      x: rect.left - outer.left + (rect.width - size.w * k) / 2,
      y: rect.top - outer.top + (rect.height - size.h * k) / 2,
    };
  };

  const drawTile = (col: number, row: number, colour: string | null) => {
    const ctx = layer.current?.getContext("2d");
    const s = stroke.current;
    if (!(ctx && s)) {
      return;
    }
    const { cell, inset } = geometry();
    const dpr = window.devicePixelRatio || 1;
    const x = (s.box.x + (col * cell + inset) * s.box.k) * dpr;
    const y = (s.box.y + (row * cell + inset) * s.box.k) * dpr;
    const side = Math.max(1, (cell - inset * 2) * s.box.k * dpr);
    if (colour) {
      ctx.clearRect(x, y, side, side);
      ctx.fillStyle = colour;
      ctx.fillRect(x, y, side, side);
    } else {
      // Put back: shown as a hatch until the mosaic is rebuilt.
      ctx.fillStyle = "rgba(127,127,127,0.55)";
      ctx.fillRect(x, y, side, side);
    }
  };

  /** Every tile on the straight line between two, so a fast drag leaves no gaps. */
  const between = (
    a: { col: number; row: number },
    b: { col: number; row: number }
  ) => {
    const steps = Math.max(Math.abs(b.col - a.col), Math.abs(b.row - a.row), 1);
    return Array.from({ length: steps }, (_, i) => ({
      col: Math.round(a.col + ((b.col - a.col) * (i + 1)) / steps),
      row: Math.round(a.row + ((b.row - a.row) * (i + 1)) / steps),
    }));
  };

  const paintAt = (e: React.PointerEvent<HTMLElement>) => {
    const s = stroke.current;
    if (!s) {
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left - s.box.x) / s.box.k;
    const y = (e.clientY - rect.top - s.box.y) / s.box.k;
    const tile = tileAt(x, y, size.w, size.h, Number(values.columns));
    if (
      !tile ||
      (s.last && s.last.col === tile.col && s.last.row === tile.row)
    ) {
      return;
    }
    const colour = erase || e.altKey ? null : brush.toLowerCase();
    for (const t of s.last ? between(s.last, tile) : [tile]) {
      setTile(s.painted, t, colour);
    }
    s.last = tile;
  };

  /** One tile painted (or put back) in the stroke, and drawn on the overlay. */
  const setTile = (
    tiles: Map<string, string>,
    t: { col: number; row: number },
    colour: string | null
  ) => {
    const { cols, rows } = geometry();
    if (t.col < 0 || t.row < 0 || t.col >= cols || t.row >= rows) {
      return;
    }
    if (colour) {
      tiles.set(tileKey(t.col, t.row), colour);
    } else {
      tiles.delete(tileKey(t.col, t.row));
    }
    drawTile(t.col, t.row, colour);
  };

  const begin = (e: React.PointerEvent<HTMLElement>) => {
    if (!keyName || e.button !== 0) {
      return;
    }
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const box = e.currentTarget;
    const canvas = layer.current;
    if (canvas) {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(box.clientWidth * dpr);
      canvas.height = Math.round(box.clientHeight * dpr);
      canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    }
    stroke.current = {
      box: fit(box),
      last: null,
      painted: paintedOf(values[keyName]),
    };
    paintAt(e);
  };

  const end = () => {
    const s = stroke.current;
    stroke.current = null;
    if (s && keyName) {
      onChange(keyName, paintedText(s.painted));
    }
  };

  // The stroke stays on the overlay until the rebuilt mosaic replaces it.
  const painted = keyName ? values[keyName] : null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: cleared whenever the paint setting changes
  useEffect(() => {
    const canvas = layer.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  }, [painted]);

  const previewProps =
    keyName && on
      ? {
          className: "studio__preview studio__preview--painting",
          onLostPointerCapture: end,
          onPointerDown: begin,
          onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
            if (stroke.current) {
              paintAt(e);
            }
          },
          onPointerUp: end,
        }
      : { className: "studio__preview" };

  const overlay = keyName ? (
    <canvas aria-hidden className="studio__paint-layer" ref={layer} />
  ) : null;

  const count = keyName ? paintedOf(values[keyName]).size : 0;
  const bar = keyName ? (
    <div className="studio__field studio-paint">
      <span>Paint tiles</span>
      <div className="studio-paint__row">
        <button
          aria-pressed={on && !erase}
          className={
            on && !erase
              ? "studio__button studio__button--primary"
              : "studio__button"
          }
          onClick={() => {
            setOn(!(on && !erase));
            setErase(false);
          }}
          title="Click or drag on the preview to colour tiles (⌥ to put them back)"
          type="button"
        >
          <Brush size={14} /> Paint
        </button>
        <ColorWell label="Tile colour" onChange={setBrush} value={brush} />
        <button
          aria-pressed={on && erase}
          className={
            on && erase
              ? "studio__button studio__button--primary"
              : "studio__button"
          }
          onClick={() => {
            setOn(!(on && erase));
            setErase(true);
          }}
          title="Put tiles back to the mosaic's colour"
          type="button"
        >
          <Eraser size={14} />
        </button>
        {count > 0 ? (
          <button
            className="studio__button"
            onClick={() => onChange(keyName, "")}
            title="Put every painted tile back"
            type="button"
          >
            <RotateCcw size={13} /> {count}
          </button>
        ) : null}
      </div>
    </div>
  ) : null;

  return { bar, overlay, previewProps };
};
