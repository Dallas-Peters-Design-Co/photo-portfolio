import {
  createContext,
  type DragEvent,
  type ReactNode,
  useContext,
  useState,
} from "react";
import type { DropPosition } from "../../../config/pageLayerMove.js";

type Move = (id: string, target: string, position: DropPosition) => void;
const LayerDrag = createContext<{
  id: string | null;
  hover: string | null;
  setId: (id: string | null) => void;
  setHover: (id: string | null) => void;
  move: Move;
} | null>(null);
export function LayerDragProvider({
  move,
  children,
}: {
  move: Move;
  children: ReactNode;
}) {
  const [id, setId] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  return (
    <LayerDrag.Provider value={{ hover, id, move, setHover, setId }}>
      {children}
    </LayerDrag.Provider>
  );
}
export function useLayerDrag() {
  const drag = useContext(LayerDrag);
  function props(id: string, group: boolean, fixed?: DropPosition) {
    if (!drag) {
      return {};
    }
    const end = () => {
      drag.setId(null);
      drag.setHover(null);
    };
    const position = (event: DragEvent): DropPosition => {
      if (fixed) {
        return fixed;
      }
      const rect = event.currentTarget.getBoundingClientRect();
      const ratio = (event.clientY - rect.top) / rect.height;
      if (group && ratio >= 0.2 && ratio <= 0.8) {
        return "inside";
      }
      return ratio < 0.5 ? "before" : "after";
    };
    const hoverPosition = drag.hover?.startsWith(`${id}/`)
      ? drag.hover.slice(id.length + 1)
      : undefined;
    return {
      "data-drop": fixed ? hoverPosition === fixed || undefined : hoverPosition,
      draggable: true,
      onDragEnd: end,
      onDragOver: (event: DragEvent) => {
        if (!drag.id || drag.id === id) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        drag.setHover(`${id}/${position(event)}`);
      },
      onDragStart: (event: DragEvent) => {
        event.stopPropagation();
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", id);
        drag.setId(id);
      },
      onDrop: (event: DragEvent) => {
        if (!drag.id) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        drag.move(drag.id, id, position(event));
        end();
      },
    };
  }
  function target(id: string, position?: DropPosition) {
    const {
      "data-drop": indicator,
      onDrop,
      onDragOver,
    } = props(id, false, position);
    return { "data-drop": indicator, onDragOver, onDrop };
  }
  return { dragging: Boolean(drag?.id), enabled: Boolean(drag), props, target };
}
