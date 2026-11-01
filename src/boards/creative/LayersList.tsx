import { Circle, ImageIcon, Square, Type } from "lucide-react";
import type { BoardItem } from "../../types";
import { layerKind } from "./creativeModel";

/** The frame's layers, front first, as a design tool lists them. */

const SHAPE_NAMES: Record<string, string> = {
  arrow: "Arrow",
  brush: "Drawing",
  ellipse: "Ellipse",
  line: "Line",
  pen: "Drawing",
  polygon: "Polygon",
  squircle: "Squircle",
  star: "Star",
  triangle: "Triangle",
};

const labelOf = (item: BoardItem): string => {
  const kind = layerKind(item);
  if (kind === "text") {
    return (item.body ?? "").split("\n")[0]?.slice(0, 40) || "Text";
  }
  if (kind === "shape") {
    const tool = (item.config as { tool?: string } | null)?.tool ?? "";
    return SHAPE_NAMES[tool] ?? "Rectangle";
  }
  return item.body?.trim() || "Image";
};

const IconFor = ({ item }: { item: BoardItem }) => {
  const kind = layerKind(item);
  if (kind === "text") {
    return <Type size={13} />;
  }
  if (kind === "shape") {
    return (item.config as { tool?: string } | null)?.tool === "ellipse" ? (
      <Circle size={13} />
    ) : (
      <Square size={13} />
    );
  }
  return <ImageIcon size={13} />;
};

export function LayersList({
  layers,
  onSelect,
  selectedIds,
}: {
  layers: BoardItem[];
  /** Shift or ⌘ adds or removes a layer instead of picking only it. */
  onSelect: (id: string, additive: boolean) => void;
  selectedIds: string[];
}) {
  if (layers.length === 0) {
    return <p className="creative__hint">Nothing on this frame yet.</p>;
  }
  return (
    <ul className="creative__layers">
      {[...layers].reverse().map((item) => (
        <li key={item.id}>
          <button
            aria-pressed={selectedIds.includes(item.id)}
            className="creative__layer-row"
            onClick={(e) => onSelect(item.id, e.shiftKey || e.metaKey)}
            type="button"
          >
            <IconFor item={item} />
            <span>{labelOf(item)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
