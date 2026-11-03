import {
  Circle,
  Component as ComponentIcon,
  GripVertical,
  ImageIcon,
  Square,
  Type,
} from "lucide-react";
import {
  type PointerEvent as ReactPointerEvent,
  useRef,
  useState,
} from "react";
import type { BoardItem } from "../../types";
import { instanceOf } from "../components/model";
import { componentById } from "../components/store";
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
  if (kind === "component") {
    const id = instanceOf(item)?.component ?? "";
    return componentById(id)?.name ?? "Component";
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
  if (kind === "component") {
    return <ComponentIcon size={13} />;
  }
  return <ImageIcon size={13} />;
};

/** How far a press must travel before it is a drag rather than a click. */
const DRAG_PX = 4;

interface ListDrag {
  /** The layer they would land in front of, or null for the back. */
  before: string | null;
  /** The layers being moved: the pressed one, or the whole selection. */
  ids: string[];
  moved: boolean;
  startY: number;
}

export function LayersList({
  layers,
  onReorder,
  onSelect,
  selectedIds,
}: {
  layers: BoardItem[];
  /** Drop the dragged layers in front of `before` (null: at the back). */
  onReorder: (ids: string[], before: string | null) => void;
  /** Shift or ⌘ adds or removes a layer instead of picking only it. */
  onSelect: (id: string, additive: boolean) => void;
  selectedIds: string[];
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const [drag, setDrag] = useState<ListDrag | null>(null);
  // A drag ends in a click on the row it started from; that click is not a pick.
  const justDragged = useRef<boolean>(false);

  if (layers.length === 0) {
    return <p className="creative__hint">Nothing on this frame yet.</p>;
  }
  const frontFirst = [...layers].reverse();

  /** The row a pointer is over decides where the drop goes: above its middle
   *  lands in front of it, below lands behind it. */
  const targetAt = (y: number): string | null => {
    const rows = [...(listRef.current?.querySelectorAll("[data-row]") ?? [])];
    for (const row of rows) {
      const r = row.getBoundingClientRect();
      if (y < r.top + r.height / 2) {
        return row.getAttribute("data-row");
      }
    }
    return null;
  };

  const press = (e: ReactPointerEvent, id: string) => {
    if (e.button !== 0) {
      return;
    }
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // A pointer the browser doesn't know (synthetic, or already gone).
    }
    setDrag({
      before: null,
      ids:
        selectedIds.length > 1 && selectedIds.includes(id) ? selectedIds : [id],
      moved: false,
      startY: e.clientY,
    });
  };

  const move = (e: ReactPointerEvent) => {
    if (!drag) {
      return;
    }
    const moved = drag.moved || Math.abs(e.clientY - drag.startY) > DRAG_PX;
    setDrag({ ...drag, before: targetAt(e.clientY), moved });
  };

  const release = () => {
    if (drag?.moved) {
      justDragged.current = true;
      onReorder(drag.ids, drag.before);
    }
    setDrag(null);
  };

  const dropLine = drag?.moved ? drag.before : undefined;
  const dropAtEnd = Boolean(drag?.moved) && drag?.before === null;
  return (
    <ul
      className={
        drag?.moved
          ? "creative__layers creative__layers--dragging"
          : "creative__layers"
      }
      ref={listRef}
    >
      {frontFirst.map((item) => (
        <li
          className={dropLine === item.id ? "creative__layer-drop" : undefined}
          data-row={item.id}
          key={item.id}
        >
          <button
            aria-pressed={selectedIds.includes(item.id)}
            className={
              drag?.moved && drag.ids.includes(item.id)
                ? "creative__layer-row creative__layer-row--moving"
                : "creative__layer-row"
            }
            onClick={(e) => {
              if (justDragged.current) {
                justDragged.current = false;
                return;
              }
              onSelect(item.id, e.shiftKey || e.metaKey);
            }}
            onPointerCancel={() => setDrag(null)}
            onPointerDown={(e) => press(e, item.id)}
            onPointerMove={move}
            onPointerUp={release}
            title="Drag to reorder · ⌥↑ / ⌥↓ to move"
            type="button"
          >
            <GripVertical
              aria-hidden
              className="creative__layer-grip"
              size={12}
            />
            <IconFor item={item} />
            <span>{labelOf(item)}</span>
          </button>
        </li>
      ))}
      <li
        aria-hidden
        className={
          dropAtEnd
            ? "creative__layer-drop creative__layer-drop--end"
            : undefined
        }
      />
    </ul>
  );
}
