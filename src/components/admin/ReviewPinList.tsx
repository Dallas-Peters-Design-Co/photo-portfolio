import { ArrowDownWideNarrow, Trash2 } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import {
  PIN_KINDS,
  PIN_LABELS,
  type ReviewImage,
  type ReviewPin,
} from "../../../config/review.js";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  proposalInputClass,
  proposalLabelClass,
  proposalTextareaClass,
} from "./proposalStyles";
import { readingOrder } from "./reviewEditing";

const moved = (ids: string[], id: string, to: number): string[] => {
  const next = ids.filter((other) => other !== id);
  next.splice(Math.max(0, Math.min(next.length, to)), 0, id);
  return next;
};

/**
 * The notes on one screen, numbered as they are on the picture. Selecting a
 * row highlights its pin and the other way round, so a note can be found
 * from either side.
 *
 * A note's number is its place in this list, so reordering the list is how
 * the pins are renumbered. The number is the drag handle — the rows are full
 * of text fields, and a draggable row would steal every text selection — and,
 * focused, it moves with the arrow keys for anyone not dragging.
 */
export function ReviewPinList({
  pins,
  image,
  firstNumber,
  selected,
  onSelect,
  onUpdate,
  onRemove,
  onReorder,
}: {
  pins: ReviewPin[];
  /** The picture, so "top to bottom" can tell a line from the next one. */
  image: ReviewImage | null;
  firstNumber: number;
  selected: string | null;
  onSelect: (id: string) => void;
  onUpdate: (id: string, next: Partial<ReviewPin>) => void;
  onRemove: (id: string) => void;
  /** The new order, once, when a drag or a key press settles. */
  onReorder: (ids: string[]) => void;
}) {
  const ids = pins.map((pin) => pin.id);
  // While a drag is in flight the list shows this order, and only the drop
  // writes it: one undo step and one save, not one per row crossed.
  const [dragOrder, setDragOrder] = useState<string[] | null>(null);
  const [grabbed, setGrabbed] = useState<string | null>(null);
  const dragged = useRef<string | null>(null);
  const shown = dragOrder
    ? dragOrder.flatMap((id) => pins.find((pin) => pin.id === id) ?? [])
    : pins;

  // A pin added or removed mid-drag ends the drag rather than fighting it.
  const idKey = ids.join();
  useEffect(() => {
    if (idKey) {
      setDragOrder(null);
    }
  }, [idKey]);

  const drop = () => {
    if (dragOrder && dragOrder.join() !== ids.join()) {
      onReorder(dragOrder);
    }
    dragged.current = null;
    setGrabbed(null);
    setDragOrder(null);
  };

  const onHandleKey = (e: KeyboardEvent, id: string, index: number) => {
    const by = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (!by) {
      return;
    }
    e.preventDefault();
    const next = moved(ids, id, index + by);
    if (next.join() !== ids.join()) {
      onReorder(next);
    }
  };

  const inReadingOrder = readingOrder(pins, image);
  const isInOrder = inReadingOrder.join() === ids.join();

  if (pins.length === 0) {
    return (
      <p className="text-sm text-white/60">
        No notes yet. Click a spot on the picture.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {pins.length > 1 ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-white/60">
            Drag a number to reorder. The pins renumber to match.
          </p>
          <Button
            disabled={isInOrder}
            onClick={() => onReorder(inReadingOrder)}
            title="Renumber the notes in the order the pins read down the picture"
            type="button"
            variant="ghost"
          >
            <ArrowDownWideNarrow size={14} />
            Number top to bottom
          </Button>
        </div>
      ) : null}
      <ol className="space-y-3">
        {shown.map((pin, i) => (
          // biome-ignore lint/a11y/noNoninteractiveElementInteractions: HTML5 drag needs its handlers on the dragged element; the keyboard path is the arrow keys on the number
          <li
            className={`space-y-2 rounded-md border p-3 ${
              selected === pin.id
                ? "border-white/40 bg-white/4"
                : "border-white/10"
            } ${grabbed === pin.id ? "opacity-50" : ""}`}
            draggable={grabbed === pin.id}
            key={pin.id}
            onDragEnd={drop}
            onDragOver={(e) => {
              // Without preventDefault the browser refuses the drop and
              // animates the row back to where it started.
              e.preventDefault();
              const held = dragged.current;
              if (held && held !== pin.id) {
                setDragOrder((order) =>
                  moved(order ?? ids, held, (order ?? ids).indexOf(pin.id))
                );
              }
            }}
            onDragStart={(e) => {
              dragged.current = pin.id;
              e.dataTransfer.effectAllowed = "move";
              setDragOrder(ids);
            }}
            onDrop={(e) => e.preventDefault()}
          >
            <div className="flex items-center gap-2">
              <button
                aria-label={`Note ${firstNumber + i}. Drag, or press up or down, to move it`}
                className="flex size-7 shrink-0 cursor-grab items-center justify-center rounded-full border border-white/30 font-semibold text-micro-md text-white active:cursor-grabbing"
                onClick={() => onSelect(pin.id)}
                onKeyDown={(e) => onHandleKey(e, pin.id, i)}
                // Arms the row only while the number is held, so pressing in a
                // text field never starts a drag.
                onPointerDown={() => setGrabbed(pin.id)}
                onPointerUp={() => {
                  if (!dragged.current) {
                    setGrabbed(null);
                  }
                }}
                type="button"
              >
                {firstNumber + i}
              </button>
              <Input
                aria-label={`Note ${firstNumber + i} title`}
                className={proposalInputClass}
                onChange={(e) => onUpdate(pin.id, { title: e.target.value })}
                onFocus={() => onSelect(pin.id)}
                placeholder="What's here"
                value={pin.title}
              />
              <select
                aria-label={`Note ${firstNumber + i} kind`}
                className={`${proposalInputClass} rounded-md border px-2`}
                onChange={(e) =>
                  onUpdate(pin.id, {
                    kind: e.target.value as ReviewPin["kind"],
                  })
                }
                value={pin.kind}
              >
                {PIN_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {PIN_LABELS[k]}
                  </option>
                ))}
              </select>
              <Button
                aria-label={`Remove note ${firstNumber + i}`}
                onClick={() => onRemove(pin.id)}
                type="button"
                variant="ghost"
              >
                <Trash2 size={14} />
              </Button>
            </div>
            <div className="space-y-1">
              <label
                className={proposalLabelClass}
                htmlFor={`pin-body-${pin.id}`}
              >
                Note
              </label>
              <textarea
                className={`${proposalTextareaClass} min-h-20`}
                id={`pin-body-${pin.id}`}
                onChange={(e) => onUpdate(pin.id, { body: e.target.value })}
                onFocus={() => onSelect(pin.id)}
                placeholder="What I'd change, and why"
                value={pin.body}
              />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
