import { Brush, Eraser, RotateCcw } from "lucide-react";
import { useRef, useState } from "react";
import { ColorWell } from "../ColorWell";
import { paintedOf, tileAt, withTile } from "./generators/paintedTiles";
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
  // Paint lands faster than the settings re-render during a drag.
  const latest = useRef<unknown>(null);
  const last = useRef<string | null>(null);
  if (keyName) {
    latest.current = values[keyName];
  }

  const paintAt = (e: React.PointerEvent<HTMLElement>) => {
    if (!keyName) {
      return;
    }
    const img = e.currentTarget.querySelector("img");
    if (!img) {
      return;
    }
    const rect = img.getBoundingClientRect();
    // The picture is fitted (contain) inside the image box.
    const k = Math.min(rect.width / size.w, rect.height / size.h);
    const x = (e.clientX - rect.left - (rect.width - size.w * k) / 2) / k;
    const y = (e.clientY - rect.top - (rect.height - size.h * k) / 2) / k;
    const tile = tileAt(x, y, size.w, size.h, Number(values.columns));
    if (!tile) {
      return;
    }
    const id = `${tile.col}.${tile.row}`;
    if (id === last.current) {
      return;
    }
    last.current = id;
    const next = withTile(
      latest.current,
      tile.col,
      tile.row,
      erase || e.altKey ? null : brush
    );
    latest.current = next;
    onChange(keyName, next);
  };

  const previewProps =
    keyName && on
      ? {
          className: "studio__preview studio__preview--painting",
          onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
            if (e.button !== 0) {
              return;
            }
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            last.current = null;
            paintAt(e);
          },
          onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
            if (e.buttons === 1) {
              paintAt(e);
            }
          },
          onPointerUp: () => {
            last.current = null;
          },
        }
      : { className: "studio__preview" };

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

  return { bar, previewProps };
};
