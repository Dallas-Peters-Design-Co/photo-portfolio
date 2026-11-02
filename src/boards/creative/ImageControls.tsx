import type { BoardItem } from "../../types";
import { ANCHORS, type Anchor, anchorOf } from "./imageAnchor";
import { imageRadius } from "./imageRadius";

/**
 * A picture layer's own settings in the bar: rounded corners, and which part
 * of the picture stays in view when its box is a different shape (a 3×3
 * grid, top left to bottom right; see imageAnchor.ts).
 */

const LABEL: Record<Anchor, string> = {
  bottom: "Pin to the bottom",
  "bottom-left": "Pin to the bottom left",
  "bottom-right": "Pin to the bottom right",
  center: "Keep it centred",
  left: "Pin to the left",
  right: "Pin to the right",
  top: "Pin to the top",
  "top-left": "Pin to the top left",
  "top-right": "Pin to the top right",
};

export function ImageControls({
  item,
  onPatch,
}: {
  item: BoardItem;
  onPatch: (patch: Partial<BoardItem>) => void;
}) {
  const current = anchorOf(item);
  const set = (next: Record<string, unknown>) =>
    onPatch({ config: { ...(item.config ?? {}), ...next } });
  return (
    <>
      {/* biome-ignore lint/a11y/noLabelWithoutControl: the control is inside */}
      <label className="creative__field">
        <span>Corners</span>
        <input
          className="creative__input creative__input--num"
          min={0}
          onChange={(e) => {
            const n = Number(e.target.value);
            set({ radius: Number.isFinite(n) ? n : 0 });
          }}
          type="number"
          value={imageRadius(item)}
        />
      </label>
      <span className="creative__field">
        <span>Position</span>
        <fieldset
          aria-label="Which part of the picture stays in view"
          className="creative-anchor"
        >
          {ANCHORS.map((anchor) => (
            <button
              aria-label={LABEL[anchor]}
              aria-pressed={current === anchor}
              className="creative-anchor__cell"
              key={anchor}
              onClick={() =>
                set({ position: anchor === "center" ? null : anchor })
              }
              title={LABEL[anchor]}
              type="button"
            />
          ))}
        </fieldset>
      </span>
    </>
  );
}
