import { normalizeTextStyle } from "../../../config/textStyle";
import type { BoardItem } from "../../types";
import { ColorWell } from "../ColorWell";
import { isDrawingConfig } from "../drawing/drawing";
import { TextControls } from "./ContextBar";
import { layerKind } from "./creativeModel";
import { ShapeControls } from "./ShapeControls";
import { sharedPatch } from "./sharedPatch";

/**
 * Styling several layers at once, in the multi-select bar.
 *
 * All text: the full text controls (font, size, weight, colour, tracking,
 * alignment, effects), shown from the first layer and applied to every one.
 * All shapes: the shape controls the same way. A mix: one colour, which is a
 * text layer's colour and a shape's fill. Only the setting touched changes on
 * each layer; the rest of each one's style stays its own (sharedPatch.ts).
 */
export function SharedControls({
  layers,
  onPatch,
}: {
  layers: BoardItem[];
  onPatch: (patches: Map<string, Partial<BoardItem>>) => void;
}) {
  const [first] = layers;
  if (!first) {
    return null;
  }
  const kinds = new Set(layers.map(layerKind));
  const apply = (patch: Partial<BoardItem>) =>
    onPatch(sharedPatch(first, patch, layers));
  if (kinds.size === 1 && kinds.has("text")) {
    return <TextControls item={first} onPatch={apply} />;
  }
  if (kinds.size === 1 && kinds.has("shape") && isDrawingConfig(first.config)) {
    return <ShapeControls config={first.config} onPatch={apply} />;
  }
  const colourable = layers.filter(
    (l) =>
      layerKind(l) === "text" ||
      (layerKind(l) === "shape" && isDrawingConfig(l.config))
  );
  const [lead] = colourable;
  if (!lead) {
    return null;
  }
  const colourOf = (l: BoardItem) =>
    layerKind(l) === "text"
      ? (l.textStyle?.color ?? "#ffffff")
      : String((l.config as { fill?: unknown } | null)?.fill ?? "#000000");
  return (
    <span className="creative__field">
      <span>Colour</span>
      <ColorWell
        label="Colour of the selected layers"
        onChange={(color) =>
          onPatch(
            new Map(
              colourable.map((l) => [
                l.id,
                layerKind(l) === "text"
                  ? {
                      textStyle: normalizeTextStyle({
                        ...(l.textStyle ?? {}),
                        color,
                      }),
                    }
                  : { config: { ...(l.config ?? {}), fill: color } },
              ])
            )
          )
        }
        value={colourOf(lead)}
      />
    </span>
  );
}
