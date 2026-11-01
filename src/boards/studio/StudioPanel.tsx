import { GripVertical, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useActiveBrand } from "../brand/ActiveBrand";
import { useDraggablePanel } from "../hooks/useDraggablePanel";
import { PaletteTool } from "./color/PaletteTool";
import { RampTool } from "./color/RampTool";
import { ImageToolView } from "./ImageToolView";
import { DEFAULT_PALETTE, IMAGE_TOOLS, STUDIO_TOOLS } from "./tools";
import type { StudioValues } from "./types";
import "./Studio.css";

/**
 * The Studio: generators for backgrounds, patterns, shapes and gradients, and
 * colour tools for palettes and ramps, all in the active brand's colours.
 * Images are previewed live and land on the board as a PNG at the size
 * chosen; palettes can be saved back to the brand kit.
 */

const GROUPS = ["Images", "Colour"] as const;

export function StudioPanel({
  initialTool,
  onAdd,
  onClose,
}: {
  initialTool: string;
  /** Places the file on the board. */
  onAdd: (file: File) => void;
  onClose: () => void;
}) {
  const brand = useActiveBrand();
  const entries = brand?.kit?.resolvedDoc.palette ?? [];
  const palette =
    entries.length > 0 ? entries.map((p) => p.value) : DEFAULT_PALETTE;
  const drag = useDraggablePanel("board-studio:position");
  const [toolId, setToolId] = useState(initialTool);
  const [byTool, setByTool] = useState<Record<string, StudioValues>>({});
  useEffect(() => setToolId(initialTool), [initialTool]);

  const imageTool = IMAGE_TOOLS.find((t) => t.id === toolId);
  const current = STUDIO_TOOLS.find((t) => t.id === toolId) ?? STUDIO_TOOLS[0];

  const view = () => {
    if (toolId === "palette") {
      return <PaletteTool onAdd={onAdd} />;
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
        key={tool.id}
        onAdd={onAdd}
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
      style={drag.style}
    >
      <header className="studio__head" {...drag.handleProps}>
        <GripVertical aria-hidden className="studio__grip" size={14} />
        <strong>Studio</strong>
        <span className="studio__brand">
          {brand?.kit ? `in ${brand.kit.name}` : "no brand chosen"}
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
    </aside>
  );
}
