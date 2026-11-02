import { useRef } from "react";
import { textStyleCss } from "../../../config/textStyle";
import type { BoardItem } from "../../types";
import { DrawingView } from "../drawing/DrawingView";
import { isDrawingConfig } from "../drawing/drawing";
import { useTextFont } from "../hooks/useTextFont";
import { useVerticalAlign } from "../hooks/useVerticalAlign";
import { currentImageUrl } from "../itemOutput";
import type { Box } from "./creativeModel";
import { objectPositionOf } from "./imageAnchor";
import { imageRadius } from "./imageRadius";

/**
 * What the artboard draws for each layer (text, shape or picture), and the
 * outline around a multiple selection. Split from Artboard.tsx, which keeps
 * the pointer handling.
 */

function LayerText({
  editing,
  item,
  onChange,
  onDone,
  textRef,
}: {
  editing: boolean;
  item: BoardItem;
  onChange: (body: string) => void;
  onDone: () => void;
  textRef: (el: HTMLElement | null) => void;
}) {
  useTextFont(item.textStyle);
  const own = useRef<HTMLTextAreaElement | null>(null);
  useVerticalAlign(own, item);
  return (
    <textarea
      className="creative__text text-body text-body--plain"
      onBlur={onDone}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.currentTarget.blur();
        }
      }}
      readOnly={!editing}
      ref={(el) => {
        own.current = el;
        textRef(el);
        if (el && editing && document.activeElement !== el) {
          el.focus();
          el.select();
        }
      }}
      style={{
        ...textStyleCss(item),
        pointerEvents: editing ? "auto" : "none",
      }}
      value={item.body ?? ""}
    />
  );
}

export function LayerBody({
  editing,
  item,
  onDone,
  onTextChange,
  textRef,
}: {
  editing: boolean;
  item: BoardItem;
  onDone: () => void;
  onTextChange: (body: string) => void;
  textRef: (el: HTMLElement | null) => void;
}) {
  if (item.kind === "text" || item.kind === "note") {
    return (
      <LayerText
        editing={editing}
        item={item}
        onChange={onTextChange}
        onDone={onDone}
        textRef={textRef}
      />
    );
  }
  if (item.kind === "drawing" && isDrawingConfig(item.config)) {
    return (
      <DrawingView
        config={item.config}
        height={item.height}
        width={item.width}
      />
    );
  }
  const url = currentImageUrl(item);
  return url ? (
    <img
      alt=""
      className="creative__image"
      draggable={false}
      height={item.height}
      src={url}
      style={{
        borderRadius: imageRadius(item) > 0 ? imageRadius(item) : undefined,
        objectPosition: objectPositionOf(item),
      }}
      width={item.width}
    />
  ) : null;
}

/**
 * The box around a multiple selection. Drawn only: presses go to the layers
 * under it, so any selected layer drags them all and Shift-click still adds
 * or removes one.
 */
export function GroupOutline({ box, frame }: { box: Box | null; frame: Box }) {
  return box ? (
    <div
      className="creative__group-box"
      style={{
        height: box.height,
        left: box.x - frame.x,
        top: box.y - frame.y,
        width: box.width,
      }}
    />
  ) : null;
}
