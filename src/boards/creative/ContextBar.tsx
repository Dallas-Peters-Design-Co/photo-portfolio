import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  Copy,
  Maximize,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  normalizeTextStyle,
  type TextStyle,
  textStyleCss,
  WEIGHT_CHOICES,
} from "../../../config/textStyle";
import { DISPLAY_FONTS } from "../../../config/theme";
import type { BoardItem } from "../../types";
import { useActiveBrand } from "../brand/ActiveBrand";
import { ColorWell } from "../ColorWell";
import {
  type DrawingConfig,
  isDrawingConfig,
  NO_FILL,
} from "../drawing/drawing";
import { type Box, layerKind, type Reorder } from "./creativeModel";
import { imageRadius } from "./imageRadius";
import { opacityOf, withOpacity } from "./layerOpacity";
import { OpacityField } from "./OpacityField";
import { normalizeAngle, rotationOf } from "./rotate";
import { TextEffects } from "./TextEffects";

/**
 * The controls for whatever layer is selected: type for text, paint for
 * shapes, and for every layer its place in the stack and on the artboard.
 */

interface ContextBarProps {
  frame: Box;
  item: BoardItem;
  onDelete: () => void;
  onDuplicate: () => void;
  onPatch: (patch: Partial<BoardItem>) => void;
  onReorder: (how: Reorder) => void;
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is passed in as children
    <label className="creative__field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function IconButton({
  children,
  label,
  onClick,
  pressed,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  pressed?: boolean;
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={pressed}
      className="creative__icon"
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

const ALIGN_ICON = {
  center: <AlignCenterVertical size={15} />,
  left: <AlignStartVertical size={15} />,
  right: <AlignEndVertical size={15} />,
};

const num = (value: string, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

function TextControls({
  item,
  onPatch,
}: {
  item: BoardItem;
  onPatch: (patch: Partial<BoardItem>) => void;
}) {
  const style = item.textStyle ?? null;
  const css = textStyleCss(item);
  const set = (next: Partial<TextStyle>) =>
    onPatch({ textStyle: normalizeTextStyle({ ...(style ?? {}), ...next }) });
  const kit = useActiveBrand()?.kit?.resolvedDoc;
  const faces = (kit?.typefaces ?? []).filter((f) => f.ref);
  const accent = kit?.palette[0]?.value ?? "#111111";
  return (
    <>
      <Field label="Font">
        <select
          className="creative__input creative__input--font"
          onChange={(e) => set({ family: e.target.value || null })}
          value={style?.family ?? ""}
        >
          <option value="">Board default</option>
          {faces.length > 0 ? (
            <optgroup label="Brand">
              {faces.map((f) => (
                <option key={f.ref} value={f.ref ?? ""}>
                  {f.name}
                  {f.role ? ` · ${f.role}` : ""}
                </option>
              ))}
            </optgroup>
          ) : null}
          <optgroup label="Site fonts">
            {DISPLAY_FONTS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </optgroup>
        </select>
      </Field>
      <Field label="Size">
        <input
          className="creative__input creative__input--num"
          max={400}
          min={8}
          onChange={(e) =>
            onPatch({ fontSize: Math.round(num(e.target.value, css.fontSize)) })
          }
          type="number"
          value={css.fontSize}
        />
      </Field>
      <Field label="Weight">
        <select
          className="creative__input"
          onChange={(e) => set({ weight: Number(e.target.value) })}
          value={Math.round(css.fontWeight / 100) * 100}
        >
          {WEIGHT_CHOICES.map((w) => (
            <option key={w.value} value={w.value}>
              {w.label}
            </option>
          ))}
        </select>
      </Field>
      <ColorWell
        label="Text colour"
        onChange={(color) => set({ color })}
        value={style?.color ?? "#ffffff"}
      />
      <div className="creative__group">
        {(["left", "center", "right"] as const).map((align) => (
          <IconButton
            key={align}
            label={`Align text ${align}`}
            onClick={() => set({ align })}
            pressed={(style?.align ?? "left") === align}
          >
            {ALIGN_ICON[align]}
          </IconButton>
        ))}
        <IconButton
          label="Italic"
          onClick={() => set({ italic: style?.italic ? null : true })}
          pressed={Boolean(style?.italic)}
        >
          <em>I</em>
        </IconButton>
        <IconButton
          label="Uppercase"
          onClick={() =>
            set({
              transform: style?.transform === "uppercase" ? null : "uppercase",
            })
          }
          pressed={style?.transform === "uppercase"}
        >
          AA
        </IconButton>
      </div>
      <Field label="Line">
        <input
          className="creative__input creative__input--num"
          max={3}
          min={0.7}
          onChange={(e) => set({ lineHeight: num(e.target.value, 1.25) })}
          step={0.05}
          type="number"
          value={css.lineHeight}
        />
      </Field>
      {/* Tracking in thousandths of an em, as type tools count it. */}
      <Field label="Tracking">
        <input
          aria-label="Tracking slider"
          className="creative__range"
          max={400}
          min={-150}
          onChange={(e) =>
            set({ letterSpacing: num(e.target.value, 0) / 1000 })
          }
          step={5}
          type="range"
          value={Math.round((style?.letterSpacing ?? 0) * 1000)}
        />
        <input
          aria-label="Tracking"
          className="creative__input creative__input--num"
          max={400}
          min={-150}
          onChange={(e) =>
            set({ letterSpacing: num(e.target.value, 0) / 1000 })
          }
          step={5}
          type="number"
          value={Math.round((style?.letterSpacing ?? 0) * 1000)}
        />
      </Field>
      <IconButton
        label={
          style?.kerning === "none"
            ? "Kerning off: turn the font's kerning on"
            : "Kerning on: turn it off"
        }
        onClick={() =>
          set({ kerning: style?.kerning === "none" ? null : "none" })
        }
        pressed={style?.kerning !== "none"}
      >
        Kern
      </IconButton>
      <TextEffects accent={accent} onSet={set} style={style} />
    </>
  );
}

function ShapeControls({
  config,
  onPatch,
}: {
  config: DrawingConfig;
  onPatch: (patch: Partial<BoardItem>) => void;
}) {
  const set = (next: Partial<DrawingConfig>) =>
    onPatch({
      config: { ...config, ...next } as unknown as Record<string, unknown>,
    });
  const isBox = config.tool === "rect" || config.tool === "rounded";
  return (
    <>
      <ColorWell
        label="Fill"
        onChange={(fill) => set({ fill })}
        value={config.fill ?? NO_FILL}
      />
      <ColorWell
        label="Outline"
        onChange={(stroke) => set({ stroke })}
        value={config.stroke}
      />
      <Field label="Outline">
        <input
          className="creative__input creative__input--num"
          max={200}
          min={0}
          onChange={(e) => set({ strokeWidth: num(e.target.value, 0) })}
          type="number"
          value={config.strokeWidth}
        />
      </Field>
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

export function ContextBar({
  frame,
  item,
  onDelete,
  onDuplicate,
  onPatch,
  onReorder,
}: ContextBarProps) {
  const kind = layerKind(item);
  const place = (patch: Partial<Box>) => onPatch(patch);
  return (
    <div className="creative__bar">
      {kind === "text" ? <TextControls item={item} onPatch={onPatch} /> : null}
      {kind === "shape" && isDrawingConfig(item.config) ? (
        <ShapeControls config={item.config} onPatch={onPatch} />
      ) : null}
      {kind === "image" ? (
        <Field label="Corners">
          <input
            className="creative__input creative__input--num"
            min={0}
            onChange={(e) =>
              onPatch({
                config: { ...item.config, radius: num(e.target.value, 0) },
              })
            }
            type="number"
            value={imageRadius(item)}
          />
        </Field>
      ) : null}
      {kind ? (
        <OpacityField
          onChange={(v) => onPatch(withOpacity(item, v))}
          value={opacityOf(item)}
        />
      ) : null}
      <span className="creative__divider" />
      <div className="creative__group">
        <IconButton
          label="Align to left edge"
          onClick={() => place({ x: frame.x })}
        >
          <AlignStartVertical size={15} />
        </IconButton>
        <IconButton
          label="Centre horizontally"
          onClick={() =>
            place({ x: Math.round(frame.x + (frame.width - item.width) / 2) })
          }
        >
          <AlignCenterVertical size={15} />
        </IconButton>
        <IconButton
          label="Align to right edge"
          onClick={() => place({ x: frame.x + frame.width - item.width })}
        >
          <AlignEndVertical size={15} />
        </IconButton>
        <IconButton label="Align to top" onClick={() => place({ y: frame.y })}>
          <AlignStartHorizontal size={15} />
        </IconButton>
        <IconButton
          label="Centre vertically"
          onClick={() =>
            place({ y: Math.round(frame.y + (frame.height - item.height) / 2) })
          }
        >
          <AlignCenterHorizontal size={15} />
        </IconButton>
        <IconButton
          label="Align to bottom"
          onClick={() => place({ y: frame.y + frame.height - item.height })}
        >
          <AlignEndHorizontal size={15} />
        </IconButton>
        <IconButton
          label="Fill the artboard"
          onClick={() =>
            place({
              height: frame.height,
              width: frame.width,
              x: frame.x,
              y: frame.y,
            })
          }
        >
          <Maximize size={15} />
        </IconButton>
      </div>
      <Field label="Rotate">
        <input
          className="creative__input creative__input--num"
          max={180}
          min={-180}
          onChange={(e) =>
            onPatch({ rotation: normalizeAngle(num(e.target.value, 0)) })
          }
          step={1}
          type="number"
          value={rotationOf(item)}
        />
      </Field>
      <span className="creative__divider" />
      <div className="creative__group">
        <IconButton
          label="Bring to front (⇧⌘])"
          onClick={() => onReorder("front")}
        >
          <ArrowUpToLine size={15} />
        </IconButton>
        <IconButton
          label="Bring forward (⌘])"
          onClick={() => onReorder("forward")}
        >
          <ArrowUp size={15} />
        </IconButton>
        <IconButton
          label="Send backward (⌘[)"
          onClick={() => onReorder("backward")}
        >
          <ArrowDown size={15} />
        </IconButton>
        <IconButton
          label="Send to back (⇧⌘[)"
          onClick={() => onReorder("back")}
        >
          <ArrowDownToLine size={15} />
        </IconButton>
        <IconButton label="Duplicate (⌘D)" onClick={onDuplicate}>
          <Copy size={15} />
        </IconButton>
        <IconButton label="Delete" onClick={onDelete}>
          <Trash2 size={15} />
        </IconButton>
      </div>
    </div>
  );
}
