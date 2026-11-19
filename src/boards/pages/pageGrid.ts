import type { PageBox } from "../../../config/pageDesign.js";

/** Shared row boundaries preserve authored overlaps and gaps. Occupied rows
 * can grow when text wraps, moving subsequent rows with them. */
export function pageGrid(boxes: PageBox[]) {
  const edges = [
    ...new Set([0, ...boxes.flatMap((box) => [box.y, box.y + box.height])]),
  ].sort((a, b) => a - b);
  const rows = edges.slice(1).map((end, index) => {
    const start = edges[index];
    const size = end - start;
    return boxes.some((box) => box.y <= start && box.y + box.height >= end)
      ? `minmax(${size}px, auto)`
      : `${size}px`;
  });
  return {
    rows: rows.join(" "),
    style: (box: PageBox) => ({
      gridColumn: 1,
      gridRow: `${edges.indexOf(box.y) + 1} / ${edges.indexOf(box.y + box.height) + 1}`,
      marginLeft: box.x,
      minWidth: 0,
      width: box.width,
    }),
  };
}
