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
  LogOut,
  Maximize,
  Palette,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";
import { MAX_FONT_SIZE, MIN_FONT_SIZE } from "../../../config/canvas";
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
import { isDrawingConfig } from "../drawing/drawing";
import { Field, num } from "./barFields";
import { type Box, layerKind, type Reorder } from "./creativeModel";
import { ImageControls } from "./ImageControls";
import { opacityOf, withOpacity } from "./layerOpacity";
import { OpacityField } from "./OpacityField";
import { normalizeAngle, rotationOf } from "./rotate";
import { ShapeControls } from "./ShapeControls";
import { TextEffects } from "./TextEffects";
import { TextFitControl } from "./TextFitControl";

/**
 * The controls for whatever layer is selected: type for text, paint for
 * shapes, and for every layer its place in the stack and on the artboard.
 */

interface ContextBarProps {
  frame: Box;
  item: BoardItem;
  onDelete: () => void;
  onDuplicate: () => void;
  /** Opens a picture made in the Studio there again, to change it. */
  onEditInStudio?: () => void;
  /** Opens the Studio to fill the selected shape. */
  onFillFromStudio?: () => void;
  onPatch: (patch: Partial<BoardItem>) => void;
  onReorder: (how: Reorder) => void;
  /** Off the frame and back onto the board. */
  onToBoard: () => void;
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

export function TextControls({
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
          max={MAX_FONT_SIZE}
          min={MIN_FONT_SIZE}
          onChange={(e) =>
            onPatch({
              fontSize: Math.min(
                MAX_FONT_SIZE,
                Math.round(num(e.target.value, css.fontSize))
              ),
            })
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

export function ContextBar({
  frame,
  item,
  onDelete,
  onDuplicate,
  onEditInStudio,
  onFillFromStudio,
  onPatch,
  onReorder,
  onToBoard,
}: ContextBarProps) {
  const kind = layerKind(item);
  const place = (patch: Partial<Box>) => onPatch(patch);
  return (
    <div className="creative__bar">
      {kind === "text" ? (
        <>
          <TextControls item={item} onPatch={onPatch} />
          <TextFitControl item={item} onPatch={onPatch} />
        </>
      ) : null}
      {kind === "shape" && isDrawingConfig(item.config) ? (
        <ShapeControls
          config={item.config}
          onFillFromStudio={onFillFromStudio}
          onPatch={onPatch}
        />
      ) : null}
      {onEditInStudio && kind !== "shape" ? (
        <button
          className="creative__icon creative__icon--label"
          onClick={onEditInStudio}
          title="Open it in the Studio with its settings, change it, and update it here"
          type="button"
        >
          <Palette size={15} /> Edit in Studio
        </button>
      ) : null}
      {kind === "image" ? (
        <ImageControls item={item} onPatch={onPatch} />
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
        <IconButton label="Move to the board (⇧B)" onClick={onToBoard}>
          <LogOut size={15} />
        </IconButton>
        <IconButton label="Delete" onClick={onDelete}>
          <Trash2 size={15} />
        </IconButton>
      </div>
    </div>
  );
}
