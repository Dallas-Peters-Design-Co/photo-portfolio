import {
  Palette,
  PanelBottom,
  PanelLeft,
  PanelRight,
  PanelTop,
  X,
} from "lucide-react";
import type { BoardItem } from "../../types";
import { ColorWell } from "../ColorWell";
import { type DrawingConfig, NO_FILL } from "../drawing/drawing";
import {
  BORDER_SIDES,
  type BorderSide,
  borderSidesOf,
  fillImageOf,
  isBoxTool,
} from "../drawing/shapePaint";
import { Field, num } from "./barFields";

const SIDE_ICON: Record<BorderSide, typeof PanelTop> = {
  bottom: PanelBottom,
  left: PanelLeft,
  right: PanelRight,
  top: PanelTop,
};

/** The weight a border takes when a side is switched on with none. */
const FIRST_BORDER = 8;

/**
 * Paint for a shape: its fill (a colour, or a picture from the Studio over
 * it), its border (colour, weight, and for a box, which sides), and the
 * shape's own settings (sides, points, corners).
 */
export function ShapeControls({
  config,
  onFillFromStudio,
  onPatch,
}: {
  config: DrawingConfig;
  /** Opens the Studio to fill the shape (or change its fill). */
  onFillFromStudio?: () => void;
  onPatch: (patch: Partial<BoardItem>) => void;
}) {
  const set = (next: Partial<DrawingConfig> & { studio?: null }) =>
    onPatch({
      config: { ...config, ...next } as unknown as Record<string, unknown>,
    });
  const isBox = isBoxTool(config.tool);
  const sides = borderSidesOf(config);
  const picture = fillImageOf(config);
  const toggleSide = (side: BorderSide) => {
    const on = sides.includes(side);
    const all = sides.length === BORDER_SIDES.length;
    // From a border all round, a side picks that side alone: a rule along a
    // banner's foot is one click, not three. After that, sides toggle.
    const next = all
      ? [side]
      : BORDER_SIDES.filter((s) => (s === side ? !on : sides.includes(s)));
    set({
      // All four is the plain border; the list is only kept for some sides.
      borderSides: next.length === BORDER_SIDES.length ? undefined : next,
      ...(config.strokeWidth > 0 ? {} : { strokeWidth: FIRST_BORDER }),
    });
  };
  return (
    <>
      <ColorWell
        label="Fill"
        onChange={(fill) => set({ fill })}
        value={config.fill ?? NO_FILL}
      />
      {onFillFromStudio ? (
        <button
          className="creative__icon creative__icon--label"
          onClick={onFillFromStudio}
          title={
            picture
              ? "Change the Studio picture filling this shape"
              : "Fill the shape with a gradient, pattern or texture from the Studio"
          }
          type="button"
        >
          <Palette size={15} /> {picture ? "Edit fill" : "Studio fill"}
        </button>
      ) : null}
      {picture ? (
        <button
          aria-label="Take the Studio fill off"
          className="creative__icon"
          onClick={() => set({ fillImage: undefined, studio: null })}
          title="Take the Studio fill off"
          type="button"
        >
          <X size={15} />
        </button>
      ) : null}
      <ColorWell
        label="Border"
        onChange={(stroke) => set({ stroke })}
        value={config.stroke}
      />
      <Field label="Border">
        <input
          className="creative__input creative__input--num"
          max={200}
          min={0}
          onChange={(e) => set({ strokeWidth: num(e.target.value, 0) })}
          type="number"
          value={config.strokeWidth}
        />
      </Field>
      {isBox ? <BorderSides onToggle={toggleSide} sides={sides} /> : null}
      <ShapeOptions config={config} set={set} />
    </>
  );
}

function BorderSides({
  onToggle,
  sides,
}: {
  onToggle: (side: BorderSide) => void;
  sides: BorderSide[];
}) {
  const all = sides.length === BORDER_SIDES.length;
  return (
    <div className="creative__group">
      {BORDER_SIDES.map((side) => {
        const label = all
          ? `Border on the ${side} only`
          : `Border on the ${side}`;
        const Icon = SIDE_ICON[side];
        return (
          <button
            aria-label={label}
            aria-pressed={sides.includes(side)}
            className="creative__icon"
            key={side}
            onClick={() => onToggle(side)}
            title={label}
            type="button"
          >
            <Icon size={15} />
          </button>
        );
      })}
    </div>
  );
}

/** A polygon's sides, a star's points and depth, a box's corners. */
function ShapeOptions({
  config,
  set,
}: {
  config: DrawingConfig;
  set: (next: Partial<DrawingConfig>) => void;
}) {
  const isBox = isBoxTool(config.tool);
  return (
    <>
      {config.tool === "polygon" || config.tool === "star" ? (
        <Field label={config.tool === "star" ? "Points" : "Sides"}>
          <input
            className="creative__input creative__input--num"
            max={config.tool === "star" ? 24 : 12}
            min={3}
            onChange={(e) => set({ sides: num(e.target.value, 5) })}
            type="number"
            value={config.sides ?? (config.tool === "star" ? 5 : 6)}
          />
        </Field>
      ) : null}
      {config.tool === "star" ? (
        <Field label="Inner">
          <input
            className="creative__range"
            max={0.95}
            min={0.1}
            onChange={(e) => set({ innerRatio: num(e.target.value, 0.45) })}
            step={0.05}
            type="range"
            value={config.innerRatio ?? 0.45}
          />
        </Field>
      ) : null}
      {isBox ? (
        <Field label="Corners">
          <input
            className="creative__input creative__input--num"
            min={0}
            onChange={(e) =>
              set({ radius: num(e.target.value, 0), tool: "rounded" })
            }
            type="number"
            value={config.radius ?? (config.tool === "rounded" ? 18 : 0)}
          />
        </Field>
      ) : null}
    </>
  );
}
