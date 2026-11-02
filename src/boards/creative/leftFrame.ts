import { toast } from "sonner";
import { requestHistory } from "../hooks/historyRequest";
import type { Box } from "./creativeModel";

/**
 * Layers dragged off the artboard leave the design.
 *
 * A layer belongs to the frame its centre is in, so a drag that ends with a
 * centre outside the frame has taken that layer out onto the board, and it
 * goes from the editor. That's how something is pulled out of a design, so
 * the drag isn't stopped at the edge; it says what happened instead, with a
 * one-click way back.
 */
const centreOutside = (box: Box, frame: Box) => {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  return (
    cx < frame.x ||
    cx > frame.x + frame.width ||
    cy < frame.y ||
    cy > frame.y + frame.height
  );
};

export const sayIfLeftFrame = (boxes: Box[], frame: Box): void => {
  const gone = boxes.filter((b) => centreOutside(b, frame)).length;
  if (gone === 0) {
    return;
  }
  toast(
    gone === 1
      ? "Moved out of the frame onto the board"
      : `${gone} layers moved out of the frame onto the board`,
    {
      action: { label: "Undo", onClick: () => requestHistory(false) },
      description:
        "Its centre left the artboard, so it's no longer part of the design.",
    }
  );
};
