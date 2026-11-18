import { type KeyboardEvent, type PointerEvent, useRef, useState } from "react";
import { stepsOf } from "../../../config/conceptSteps.js";
import {
  boxOf,
  type PageBox,
  type PageDesign,
  pageBoxStyle,
} from "../../../config/pageDesign.js";
import { PageDesignView } from "./PageDesignView";

interface Drag {
  before: PageBox;
  box: PageBox;
  id: string;
  resize: boolean;
  scale: number;
  x: number;
  y: number;
}

export function PageCanvasStage({
  page,
  onBox,
  onSelect,
  selected,
  stepIndex,
}: {
  onBox: (id: string, box: PageBox) => void;
  onSelect: (id: string) => void;
  page: PageDesign;
  selected: string | null;
  stepIndex: number;
}) {
  const drag = useRef<Drag | null>(null);
  const [preview, setPreview] = useState<Drag | null>(null);
  const elements = stepsOf(page.concept)[stepIndex]?.elements ?? [];
  const shown = preview
    ? { ...page, boxes: { ...page.boxes, [preview.id]: preview.box } }
    : page;
  const start = (
    e: PointerEvent<HTMLButtonElement>,
    id: string,
    index: number,
    resize: boolean
  ) => {
    if (e.button !== 0) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    onSelect(id);
    e.currentTarget.focus();
    e.currentTarget.setPointerCapture(e.pointerId);
    const box = boxOf(page, id, index);
    const sheet = e.currentTarget.closest(".page-design__sheet");
    drag.current = {
      before: box,
      box,
      id,
      resize,
      scale: (sheet?.getBoundingClientRect().width ?? page.width) / page.width,
      x: e.clientX,
      y: e.clientY,
    };
  };
  const move = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) {
      return;
    }
    const dx = (e.clientX - d.x) / d.scale;
    const dy = (e.clientY - d.y) / d.scale;
    const box = d.resize
      ? {
          ...d.before,
          height: Math.max(
            24,
            Math.min(page.height - d.before.y, Math.round(d.before.height + dy))
          ),
          width: Math.max(
            24,
            Math.min(page.width - d.before.x, Math.round(d.before.width + dx))
          ),
        }
      : {
          ...d.before,
          x: Math.max(
            0,
            Math.min(page.width - d.before.width, Math.round(d.before.x + dx))
          ),
          y: Math.max(
            0,
            Math.min(page.height - d.before.height, Math.round(d.before.y + dy))
          ),
        };
    drag.current = { ...d, box };
    setPreview(drag.current);
  };
  const finish = () => {
    const d = drag.current;
    drag.current = null;
    setPreview(null);
    if (d) {
      onBox(d.id, d.box);
    }
  };
  const cancel = () => {
    drag.current = null;
    setPreview(null);
  };
  const nudge = (e: KeyboardEvent, id: string, index: number) => {
    const direction = {
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
    }[e.key];
    if (!direction) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    const box = boxOf(page, id, index);
    const by = e.shiftKey ? 10 : 1;
    onBox(id, {
      ...box,
      x: Math.max(
        0,
        Math.min(page.width - box.width, box.x + (direction[0] ?? 0) * by)
      ),
      y: Math.max(
        0,
        Math.min(page.height - box.height, box.y + (direction[1] ?? 0) * by)
      ),
    });
  };
  return (
    <div className="page-builder__stage">
      <PageDesignView page={shown} stepIndex={stepIndex}>
        {elements.map((el, i) => (
          <div
            className={`page-builder__selection ${selected === el.id ? "page-builder__selection--active" : ""}`}
            key={el.id}
            style={pageBoxStyle(boxOf(shown, el.id, i))}
          >
            <button
              aria-label={`Move ${el.text || el.kind}`}
              className="page-builder__move"
              onFocus={() => onSelect(el.id)}
              onKeyDown={(e) => nudge(e, el.id, i)}
              onPointerCancel={cancel}
              onPointerDown={(e) => start(e, el.id, i, false)}
              onPointerMove={move}
              onPointerUp={finish}
              type="button"
            />
            {selected === el.id ? (
              <button
                aria-label={`Resize ${el.text || el.kind}`}
                className="page-builder__resize"
                onPointerCancel={cancel}
                onPointerDown={(e) => start(e, el.id, i, true)}
                onPointerMove={move}
                onPointerUp={finish}
                type="button"
              />
            ) : null}
          </div>
        ))}
      </PageDesignView>
    </div>
  );
}
