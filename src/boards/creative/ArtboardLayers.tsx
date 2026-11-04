import { useRef } from "react";
import { textStyleCss } from "../../../config/textStyle";
import type { BoardItem } from "../../types";
import { InstanceView } from "../components/InstanceView";
import { DrawingView } from "../drawing/DrawingView";
import { isDrawingConfig } from "../drawing/drawing";
import { useTextFont } from "../hooks/useTextFont";
import { useVerticalAlign } from "../hooks/useVerticalAlign";
import { currentImageUrl } from "../itemOutput";
import type { Box } from "./creativeModel";
import { fitOf, objectPositionOf, tintOf } from "./imageAnchor";
import { imageRadius } from "./imageRadius";
import { HANDLES, type Handle } from "./SelectionBox";
import { TintedPicture } from "./TintedPicture";

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
  textRefFor,
}: {
  editing: boolean;
  item: BoardItem;
  onDone: () => void;
  onTextChange: (body: string) => void;
  textRef: (el: HTMLElement | null) => void;
  /** For a placed component: registers its inner text layers by their ids. */
  textRefFor?: (id: string, el: HTMLElement | null) => void;
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
  if (item.kind === "component") {
    return <InstanceView item={item} textRef={textRefFor} />;
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
  const tint = tintOf(item);
  if (url && tint) {
    return (
      <TintedPicture
        className="creative__image"
        fit={fitOf(item)}
        position={objectPositionOf(item)}
        radius={imageRadius(item)}
        tint={tint}
        url={url}
      />
    );
  }
  return url ? (
    <img
      alt=""
      className="creative__image"
      draggable={false}
      height={item.height}
      src={url}
      style={{
        borderRadius: imageRadius(item) > 0 ? imageRadius(item) : undefined,
        objectFit: fitOf(item),
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
export function GroupOutline({
  box,
  frame,
  onScale,
  scale,
}: {
  box: Box | null;
  frame: Box;
  /** A press on a handle: the whole group resizes from there. */
  onScale?: (e: React.PointerEvent, handle: Handle) => void;
  scale?: number;
}) {
  return box ? (
    <div
      className="creative__group-box"
      style={{
        height: box.height,
        left: box.x - frame.x,
        top: box.y - frame.y,
        width: box.width,
        ["--s" as string]: scale ?? 1,
      }}
    >
      {onScale
        ? HANDLES.map((handle) => (
            <span
              aria-hidden
              className={`creative__handle creative__handle--${handle} creative__group-handle`}
              key={handle}
              onPointerDown={(e) => onScale(e, handle)}
            />
          ))
        : null}
    </div>
  ) : null;
}
