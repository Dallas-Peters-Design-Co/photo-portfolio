import { useLayoutEffect, useRef, useState } from "react";
import type { BoardItem } from "../../types";
import { LayerBody } from "../creative/ArtboardLayers";
import { opacityCss } from "../creative/layerOpacity";
import { rotateCss, rotationOf } from "../creative/rotate";
import "../creative/CreativeEditor.css";
import "../itemBodies.css";
import "./PresentDeck.css";

/**
 * One frame as a slide: everything in it, laid out as in the frame editor,
 * scaled to fit the window. Drawn with the editor's own layer renderer, so a
 * poster presents exactly as it was designed.
 */
export function FrameSlide({
  frame,
  layers,
}: {
  frame: BoardItem;
  layers: BoardItem[];
}) {
  const room = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0);

  useLayoutEffect(() => {
    const el = room.current;
    if (!el) {
      return;
    }
    const fit = () =>
      setScale(
        Math.min(el.clientWidth / frame.width, el.clientHeight / frame.height)
      );
    fit();
    const watch = new ResizeObserver(fit);
    watch.observe(el);
    return () => watch.disconnect();
  }, [frame.height, frame.width]);

  return (
    <div className="present__frame-room" ref={room}>
      <div
        className="present__frame-fit"
        style={{ height: frame.height * scale, width: frame.width * scale }}
      >
        <div
          className="creative__board present__frame-board"
          style={{
            height: frame.height,
            transform: `scale(${scale})`,
            width: frame.width,
          }}
        >
          {layers.map((item) => (
            <div
              className="present__layer"
              key={item.id}
              style={{
                height: item.height,
                left: item.x - frame.x,
                opacity: opacityCss(item),
                top: item.y - frame.y,
                transform: rotateCss(rotationOf(item)),
                width: item.width,
              }}
            >
              <LayerBody
                editing={false}
                item={item}
                onDone={noop}
                onTextChange={noop}
                textRef={noop}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const noop = () => undefined;
