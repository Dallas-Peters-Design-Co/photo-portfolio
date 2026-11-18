import {
  mapPalettePaints,
  parsePaletteToken,
} from "../../../config/paletteBinding.js";
import type { BoardItem } from "../../types";
import { expandAll } from "../components/model";
import { componentById } from "../components/store";

/** Standalone SVG, canvas and print HTML need the current paint at export time. */
export function exportLayers(items: BoardItem[]): BoardItem[] {
  const scope = document.querySelector("[data-board-palette]");
  const style = scope && getComputedStyle(scope);
  return mapPalettePaints(expandAll(items, componentById), (value) => {
    const token = parsePaletteToken(value);
    if (!token) {
      return value;
    }
    return style?.getPropertyValue(`--kit-${token[1]}`).trim() || token[2];
  });
}
