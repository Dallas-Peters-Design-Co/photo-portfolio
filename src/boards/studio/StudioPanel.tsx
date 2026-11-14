import { GripVertical, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { TypeScale } from "../../../config/typeScale.js";
import { useActiveBrand } from "../brand/ActiveBrand";
import { useDraggablePanel } from "../hooks/useDraggablePanel";
import { PaletteTool } from "./color/PaletteTool";
import { RampTool } from "./color/RampTool";
import { ImageToolView, type StudioEditing } from "./ImageToolView";
import { lastValues, rememberValues } from "./presets";
import {
  DEFAULT_PALETTE,
  defaultsOf,
  IMAGE_TOOLS,
  STUDIO_TOOLS,
} from "./tools";
import { TypeScaleTool } from "./type/TypeScaleTool";
import type { StudioParam, StudioRecipe, StudioValues } from "./types";
import { useStudioSize } from "./useStudioSize";
import "./Studio.css";

/**
 * The Studio: generators for backgrounds, patterns, shapes and gradients, and
 * colour tools for palettes and ramps, all in the active brand's colours.
 * Images are previewed live and land on the board as a PNG at the size
 * chosen; palettes can be saved back to the brand kit.
 */

const GROUPS = ["Images", "Colour", "Type"] as const;

/**
 * The frame the Studio is working for, when it's opened from the frame
 * editor: its size comes first among the sizes, "Add to board" becomes "Add
 * to frame", a picture can be set as the frame's background, and the type
 * scale can be applied to the frame's text.
 */
export interface StudioFrame {
  name: string;
  onApplyType: (scale: TypeScale) => void;
  onBackground: (file: File, recipe: StudioRecipe) => void;
  /** Over the whole frame, on top: for a picture made from the selection in place. */
  onOver?: (file: File, recipe: StudioRecipe) => void;
  /** How many layers are selected in the frame (0: the whole design). */
  selectionCount?: number;
  size: { h: number; w: number } | null;
  /** The frame's selection (or whole design) drawn as a picture. */
  snapshot?: () => Promise<Blob>;
  /** The selection where it sits in the frame, the rest left clear. */
  snapshotInPlace?: () => Promise<Blob>;
}

/**
 * A tool's settings as it was last left in this browser, on top of its
 * defaults (so a setting added since still has a value): the Studio opens
 * where it was, frame after frame.
 */
const lastOf = (tool: string, params: StudioParam[]) => {
  const last = lastValues(tool);
  return last ? { ...defaultsOf(params), ...last } : undefined;
};

/**
 * What a tool is working on: a shape's fill whichever tool fills it (with
 * the recipe only for the tool that made it), a placed picture only in the
 * tool that made it.
 */
const editingFor = (
  editing: StudioEditing | undefined,
  tool: string
): StudioEditing | undefined => {
  if (editing?.fill) {
    return editing.recipe?.tool === tool
      ? editing
      : { ...editing, recipe: null };
  }
  return editing?.recipe?.tool === tool ? editing : undefined;
};

export function StudioPanel({
  editing,
  frame,
  initialTool,
  onAdd,
  onClose,
}: {
  /** A placed Studio picture opened to be changed, or a shape to fill. */
  editing?: StudioEditing;
  frame?: StudioFrame;
  initialTool: string;
  /**
   * Places the file on the board (or in the frame), with how it was made when
   * an image tool made it.
   */
  onAdd: (file: File, recipe?: StudioRecipe) => void;
  onClose: () => void;
}) {
  const brand = useActiveBrand();
  const entries = brand?.kit?.resolvedDoc.palette ?? [];
  const palette =
    entries.length > 0 ? entries.map((p) => p.value) : DEFAULT_PALETTE;
  const drag = useDraggablePanel("board-studio:position");
  const size = useStudioSize(drag.pin);
  const [toolId, setToolId] = useState(initialTool);
  const [byTool, setByTool] = useState<Record<string, StudioValues>>(() =>
    editing?.recipe ? { [editing.recipe.tool]: editing.recipe.values } : {}
  );
  useEffect(() => setToolId(initialTool), [initialTool]);

  const imageTool = IMAGE_TOOLS.find((t) => t.id === toolId);
  const current = STUDIO_TOOLS.find((t) => t.id === toolId) ?? STUDIO_TOOLS[0];

  const view = () => {
    if (toolId === "palette") {
      return <PaletteTool onAdd={onAdd} />;
    }
    if (toolId === "type-scale") {
      return <TypeScaleTool onAdd={onAdd} onApply={frame?.onApplyType} />;
    }
    if (toolId === "ramps") {
      return (
        <RampTool
          onAdd={onAdd}
          palette={
            entries.length > 0
              ? entries
              : DEFAULT_PALETTE.map((value) => ({ name: "", value }))
          }
        />
      );
    }
    const tool = imageTool ?? IMAGE_TOOLS[0];
    return tool ? (
      <ImageToolView
        editing={editingFor(editing, tool.id)}
        frame={frame}
        key={tool.id}
        onAdd={onAdd}
        onResize={size.startResize}
        onResizeReset={size.reset}
        onValues={(values) => {
          rememberValues(tool.id, values);
          setByTool((was) => ({ ...was, [tool.id]: values }));
        }}
        palette={palette}
        tool={tool}
        values={byTool[tool.id] ?? lastOf(tool.id, tool.params)}
      />
    ) : null;
  };

  return (
    <aside
      aria-label="Studio"
      className={drag.dragging ? "studio studio--dragging" : "studio"}
      style={{ ...drag.style, ...size.style }}
    >
      <header className="studio__head" {...drag.handleProps}>
        <GripVertical aria-hidden className="studio__grip" size={14} />
        <strong>Studio</strong>
        <span className="studio__brand">
          {frame ? `for ${frame.name}` : ""}
          {frame && brand?.kit ? " · " : ""}
          {brand?.kit ? `in ${brand.kit.name}` : ""}
          {frame || brand?.kit ? "" : "no brand chosen"}
        </span>
        <button
          aria-label="Close the Studio"
          className="studio__icon"
          onClick={onClose}
          type="button"
        >
          <X size={15} />
        </button>
      </header>
      <div className="studio__body">
        <nav className="studio__tools">
          {GROUPS.map((group) => (
            <div className="studio__group" key={group}>
              <span className="studio__group-label">{group}</span>
              {STUDIO_TOOLS.filter((t) => t.group === group).map((t) => (
                <button
                  aria-pressed={t.id === current?.id}
                  key={t.id}
                  onClick={() => setToolId(t.id)}
                  title={t.blurb}
                  type="button"
                >
                  {t.name}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <section className="studio__main">{view()}</section>
      </div>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: a pointer drag handle; the panel works at its default size */}
      <span
        aria-hidden
        className="studio__corner"
        onDoubleClick={size.reset}
        onPointerDown={size.startResize}
        title="Drag to resize · double-click to reset"
      />
    </aside>
  );
}
