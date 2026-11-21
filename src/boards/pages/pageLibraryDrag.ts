import type { DragEvent } from "react";
import type { GridCell } from "../../../config/pageFrameGrid.js";

const COMPONENT_TYPE = "application/x-page-library-component";

export interface LibraryPlacement {
  cell?: GridCell;
  x: number;
  y: number;
}

export function libraryDrag(value: string) {
  return {
    draggable: true,
    onDragStart: (event: DragEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      event.dataTransfer.effectAllowed = "copy";
      event.dataTransfer.setData(COMPONENT_TYPE, value);
    },
  };
}

// Computed grid tracks are in unscaled CSS pixels, including implicit rows.
function trackAt(tracks: string, gap: number, offset: number) {
  const sizes = tracks.split(" ").map(Number.parseFloat);
  let end = 0;
  for (const [index, size] of sizes.entries()) {
    end += size;
    if (offset <= end + gap / 2) {
      return index + 1;
    }
    end += gap;
  }
  return sizes.length;
}

export function libraryDrop(
  grid: boolean,
  insert: (value: string, placement: LibraryPlacement) => void
) {
  return {
    onDragOver: (event: DragEvent) => {
      if (event.dataTransfer.types.includes(COMPONENT_TYPE)) {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "copy";
      }
    },
    onDrop: (event: DragEvent) => {
      const value = event.dataTransfer.getData(COMPONENT_TYPE);
      if (!value) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const sheet =
        event.target instanceof Element &&
        event.target.closest<HTMLElement>(".page-design__sheet");
      if (!sheet) {
        return;
      }
      const rect = sheet.getBoundingClientRect();
      const scale = rect.width / sheet.offsetWidth;
      const x = Math.round((event.clientX - rect.left) / scale);
      const y = Math.round((event.clientY - rect.top) / scale);
      const placement: LibraryPlacement = { x, y };
      if (grid) {
        const style = getComputedStyle(sheet);
        placement.cell = {
          column: trackAt(
            style.gridTemplateColumns,
            Number.parseFloat(style.columnGap),
            x
          ),
          columnSpan: 1,
          row: trackAt(
            style.gridTemplateRows,
            Number.parseFloat(style.rowGap),
            y
          ),
          rowSpan: 1,
        };
      }
      insert(value, placement);
    },
  };
}
