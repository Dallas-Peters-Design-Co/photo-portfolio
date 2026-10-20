import { PORT_HIT_PX, PORT_RADIUS_PX } from "../../config/canvas.js";
import { inputPortsFor, outputPortsFor } from "../../config/graph.js";
import type { BoardItem } from "../types";
import type { PortHandlers } from "./BoardItemView";
import { inputPoints, outputPoints } from "./geometry/portGeometry";

/** A port's name, in screen pixels: legible tired, small beside the node. */
const PORT_LABEL_PX = 11;

interface PortHandlesProps {
  handlers: PortHandlers;
  item: BoardItem;
  scale: number;
}

/**
 * The little circles a wire is dragged between.
 *
 * Sized in screen pixels and divided by the zoom, like every other piece of
 * canvas chrome: a handle that scaled would be untappable on a board fitted to
 * the window and absurd at 300%.
 *
 * The hit target is far larger than the visible dot — the button is the target,
 * the dot is drawn inside it — so a wire can be landed on an input without
 * pixel-perfect aim, which was the friction that made connecting images to
 * nodes a matter of luck.
 *
 * Positions come from portGeometry, the same module the wires themselves use,
 * so a curve always terminates exactly on its handle.
 */
export function PortHandles({ handlers, item, scale }: PortHandlesProps) {
  const hit = PORT_HIT_PX / scale;
  const dot = (PORT_RADIUS_PX * 2) / scale;
  const inputs = inputPoints(item);
  const labelled = inputPortsFor(item).length > 1;
  const outputs = outputPoints(item);

  const style = (point: { x: number; y: number }) => ({
    height: hit,
    left: point.x - item.x,
    marginLeft: -hit / 2,
    marginTop: -hit / 2,
    top: point.y - item.y,
    width: hit,
  });

  return (
    <>
      {outputPortsFor(item).map((port) => {
        const point = outputs.get(port.key);
        return point ? (
          <button
            aria-label={`Drag a connection from ${port.label}`}
            className="board-item__port"
            data-port={port.key}
            key={`out-${port.key}`}
            onPointerDown={(e) => {
              // The surface would read this as "pick the item up and drag it".
              e.stopPropagation();
              handlers.onPortDown(item.id, port.key, {
                x: e.clientX,
                y: e.clientY,
              });
            }}
            style={style(point)}
            type="button"
          >
            <span
              aria-hidden
              className="board-item__port-dot"
              style={{ height: dot, width: dot }}
            />
          </button>
        ) : null;
      })}

      {inputPortsFor(item).map((port) => {
        const point = inputs.get(port.key);
        if (!point) {
          return null;
        }
        // Only lights up for a wire that could actually land here, so a refusal
        // is visible during the drag rather than at the drop.
        const isOpen =
          handlers.isDragging && handlers.canDropOn(item.id, port.key);
        const idle = handlers.isDragging
          ? "board-item__port-target--closed"
          : "";
        return (
          <button
            aria-label={`Connect to ${port.label}`}
            className="board-item__port"
            data-port={port.key}
            key={`in-${port.key}`}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerEnter={() => handlers.onPortEnter(item.id, port.key)}
            onPointerLeave={() => handlers.onPortLeave(item.id, port.key)}
            style={style(point)}
            type="button"
          >
            <span
              aria-hidden
              className={`board-item__port-target ${
                isOpen ? "board-item__port-target--open" : idle
              }`}
              style={{ height: dot, width: dot }}
            />
            {/* Named where it is, once a node has more than one input: five
                identical dots down a Video node's edge say nothing about
                which is the start frame and which the references. */}
            {labelled ? (
              <span
                aria-hidden
                className="board-item__port-label"
                style={{ fontSize: PORT_LABEL_PX / scale }}
              >
                {port.label}
              </span>
            ) : null}
          </button>
        );
      })}
    </>
  );
}
