import type { BoardItem } from "../../types";
import { ColorWell } from "../ColorWell";
import { ANCHORS, type Anchor, anchorOf, fitOf, tintOf } from "./imageAnchor";
import { imageRadius } from "./imageRadius";
import { SvgColoursButton } from "./SvgColoursButton";

/**
 * A picture layer's own settings in the bar: rounded corners, cover or
 * contain, one colour instead of its own (a mark recoloured), and where the picture sits when its box is a different shape (a
 * 3×3 grid, top left to bottom right; see imageAnchor.ts).
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
      <SvgColoursButton item={item} onPatch={onPatch} />
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
        <span>Fit</span>
        <span className="creative-fit">
          {(["cover", "contain"] as const).map((fit) => (
            <button
              aria-pressed={fitOf(item) === fit}
              className="creative-fit__option"
              key={fit}
              onClick={() => set({ fit: fit === "cover" ? null : fit })}
              title={
                fit === "cover"
                  ? "Fill the box; the picture is cropped to its shape"
                  : "Show the whole picture inside the box"
              }
              type="button"
            >
              {fit === "cover" ? "Cover" : "Contain"}
            </button>
          ))}
        </span>
      </span>
      <span className="creative__field">
        <span>Colour</span>
        <span className="creative-fit">
          <ColorWell
            label="Picture colour"
            onChange={(c) => set({ tint: c })}
            value={tintOf(item) ?? "#ffffff"}
          />
          <button
            aria-pressed={tintOf(item) === null}
            className="creative-fit__option"
            onClick={() => set({ tint: null })}
            title="The picture's own colours"
            type="button"
          >
            Own
          </button>
        </span>
      </span>
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
