import { GripVertical } from "lucide-react";
import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import "./SortableList.css";

/**
 * A list whose items are dragged into a new order by a handle.
 *
 * While a drag is in flight every item folds to its header (`compact`), so a
 * tall screen is as easy to carry past as a short section, and the item
 * follows the pointer while a highlighted gap shows where it will land.
 * Nothing moves in the DOM until the drop: the order on screen is set with
 * CSS `order`, so the rich editors inside are never torn out and remounted.
 *
 * The handle also moves its item with the arrow keys, for anyone not
 * dragging.
 */

interface Drag {
  /** The pointer's distance below the item's top when it was picked up. */
  grip: number;
  id: string;
  left: number;
  /** Where the item will land among the others. */
  over: number;
  top: number;
  width: number;
}

/** How near the window's edge the pointer scrolls the page, and how fast. */
const EDGE = 80;
const SCROLL_STEP = 14;
/** A drop at most this far into the header still holds the header. */
const MAX_GRIP = 24;

export interface SortableContext {
  /** True while any item in the list is being dragged. */
  compact: boolean;
  /** The drag handle, for the item's header. */
  handle: ReactNode;
}

export function SortableList<T extends { id: string }>({
  children,
  itemLabel,
  items,
  onReorder,
}: {
  children: (item: T, context: SortableContext) => ReactNode;
  /** Names an item for the handle's label, e.g. "Move Home". */
  itemLabel: (item: T) => string;
  items: T[];
  onReorder: (ids: string[]) => void;
}) {
  const list = useRef<HTMLDivElement>(null);
  const [drag, setShown] = useState<Drag | null>(null);
  // The drag as of the last event, for the next one before React re-renders:
  // pointerup and the capture's release both end a drag, and only one may.
  const current = useRef<Drag | null>(null);
  const setDrag = (next: Drag | null) => {
    current.current = next;
    setShown(next);
  };
  const [gapHeight, setGapHeight] = useState(0);
  const ids = items.map((i) => i.id);

  const wrapperOf = (id: string) =>
    list.current?.querySelector<HTMLElement>(
      `[data-sortable-id="${CSS.escape(id)}"]`
    ) ?? null;

  // Once the items have folded, the gap takes the dragged one's new height.
  // Measured once per pickup; the height does not change mid-drag.
  const dragId = drag?.id;
  useLayoutEffect(() => {
    if (dragId === undefined) {
      return;
    }
    const wrapper = list.current?.querySelector<HTMLElement>(
      `[data-sortable-id="${CSS.escape(dragId)}"]`
    );
    setGapHeight(wrapper?.offsetHeight ?? 0);
  }, [dragId]);

  /** The others' order with the dragged item placed at `over`. */
  const orderWith = (id: string, over: number): string[] => {
    const rest = ids.filter((x) => x !== id);
    rest.splice(over, 0, id);
    return rest;
  };

  const overIndex = (id: string, y: number): number => {
    let index = 0;
    for (const other of ids) {
      if (other === id) {
        continue;
      }
      const box = wrapperOf(other)?.getBoundingClientRect();
      if (box && y > box.top + box.height / 2) {
        index += 1;
      }
    }
    return index;
  };

  const pickUp = (id: string) => (e: PointerEvent<HTMLButtonElement>) => {
    const box = wrapperOf(id)?.getBoundingClientRect();
    if (e.button !== 0 || !box) {
      return;
    }
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // A pointer the browser no longer tracks; the drag still follows it.
    }
    setDrag({
      grip: Math.min(e.clientY - box.top, MAX_GRIP),
      id,
      left: box.left,
      over: ids.indexOf(id),
      top: e.clientY - Math.min(e.clientY - box.top, MAX_GRIP),
      width: box.width,
    });
  };

  const carry = (e: PointerEvent<HTMLButtonElement>) => {
    const live = current.current;
    if (!live) {
      return;
    }
    const panel = list.current?.closest<HTMLElement>("[data-sortable-scroll]");
    const bounds = panel?.getBoundingClientRect();
    const scroller = panel ?? window;
    if (e.clientY < (bounds?.top ?? 0) + EDGE) {
      scroller.scrollBy(0, -SCROLL_STEP);
    } else if (e.clientY > (bounds?.bottom ?? window.innerHeight) - EDGE) {
      scroller.scrollBy(0, SCROLL_STEP);
    }
    setDrag({
      ...live,
      over: overIndex(live.id, e.clientY),
      top: e.clientY - live.grip,
    });
  };

  const drop = () => {
    const live = current.current;
    if (!live) {
      return;
    }
    const next = orderWith(live.id, live.over);
    const { id } = live;
    setDrag(null);
    if (next.join() !== ids.join()) {
      onReorder(next);
    }
    // Unfolding moves everything; keep the dropped item in view.
    requestAnimationFrame(() =>
      wrapperOf(id)?.scrollIntoView({ block: "nearest" })
    );
  };

  const nudge = (id: string) => (e: KeyboardEvent<HTMLButtonElement>) => {
    const by = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (!by) {
      return;
    }
    e.preventDefault();
    const target = ids.indexOf(id) + by;
    if (target >= 0 && target < ids.length) {
      onReorder(orderWith(id, target));
      // React moves the item's node, which drops focus; give it back.
      requestAnimationFrame(() =>
        wrapperOf(id)
          ?.querySelector<HTMLButtonElement>(".sortable__handle")
          ?.focus()
      );
    }
  };

  // Each item's place on screen: the others in order around the gap.
  const placeOf = new Map<string, number>();
  if (drag) {
    let rank = 0;
    for (const id of ids) {
      if (id === drag.id) {
        continue;
      }
      if (rank === drag.over) {
        rank += 1;
      }
      placeOf.set(id, rank);
      rank += 1;
    }
  }

  return (
    <div className={`sortable ${drag ? "sortable--dragging" : ""}`} ref={list}>
      {items.map((item) => {
        const lifted = drag?.id === item.id;
        const style: CSSProperties | undefined = lifted
          ? { left: drag.left, top: drag.top, width: drag.width }
          : { order: placeOf.get(item.id) };
        return (
          <div
            className={`sortable__item ${lifted ? "sortable__item--lifted" : ""}`}
            data-sortable-id={item.id}
            key={item.id}
            style={style}
          >
            {children(item, {
              compact: drag !== null,
              handle: (
                <button
                  aria-label={`Move ${itemLabel(item)} (drag, or use the arrow keys)`}
                  className="sortable__handle"
                  onKeyDown={nudge(item.id)}
                  onLostPointerCapture={drop}
                  onPointerCancel={drop}
                  onPointerDown={pickUp(item.id)}
                  onPointerMove={carry}
                  onPointerUp={drop}
                  title="Drag to reorder"
                  type="button"
                >
                  <GripVertical aria-hidden size={14} />
                </button>
              ),
            })}
          </div>
        );
      })}
      {drag ? (
        <div
          aria-hidden
          className="sortable__gap"
          style={{ height: gapHeight, order: drag.over }}
        />
      ) : null}
    </div>
  );
}
