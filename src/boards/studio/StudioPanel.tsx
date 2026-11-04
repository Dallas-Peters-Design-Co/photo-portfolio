import { GripVertical, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { TypeScale } from "../../../config/typeScale.js";
import { useActiveBrand } from "../brand/ActiveBrand";
import { useDraggablePanel } from "../hooks/useDraggablePanel";
import { PaletteTool } from "./color/PaletteTool";
import { RampTool } from "./color/RampTool";
import { ImageToolView } from "./ImageToolView";
import { DEFAULT_PALETTE, IMAGE_TOOLS, STUDIO_TOOLS } from "./tools";
import { TypeScaleTool } from "./type/TypeScaleTool";
import type { StudioRecipe, StudioValues } from "./types";
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
  /** How many layers are selected in the frame (0: the whole design). */
  selectionCount?: number;
  size: { h: number; w: number } | null;
  /** The frame's selection (or whole design) drawn as a picture. */
  snapshot?: () => Promise<Blob>;
}

export function StudioPanel({
  editing,
  frame,
  initialTool,
  onAdd,
  onClose,
}: {
  /** A placed Studio picture opened to be changed (its layer's recipe). */
  editing?: {
    onReplace: (file: File, recipe: StudioRecipe) => void;
    recipe: StudioRecipe;
  };
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
    editing ? { [editing.recipe.tool]: editing.recipe.values } : {}
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
        editing={editing?.recipe.tool === tool.id ? editing : undefined}
        frame={frame}
        key={tool.id}
        onAdd={onAdd}
        onResize={size.startResize}
        onResizeReset={size.reset}
        onValues={(values) =>
          setByTool((was) => ({ ...was, [tool.id]: values }))
        }
        palette={palette}
        tool={tool}
        values={byTool[tool.id]}
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
