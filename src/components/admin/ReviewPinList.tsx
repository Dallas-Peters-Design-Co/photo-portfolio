import { Trash2 } from "lucide-react";
import { PIN_KINDS, type ReviewPin } from "../../../config/review.js";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  proposalInputClass,
  proposalLabelClass,
  proposalTextareaClass,
} from "./proposalStyles";

/**
 * The notes on one screen, numbered as they are on the picture. Selecting a
 * row highlights its pin and the other way round, so a note can be found
 * from either side.
 */
export function ReviewPinList({
  pins,
  firstNumber,
  selected,
  onSelect,
  onUpdate,
  onRemove,
}: {
  pins: ReviewPin[];
  firstNumber: number;
  selected: string | null;
  onSelect: (id: string) => void;
  onUpdate: (id: string, next: Partial<ReviewPin>) => void;
  onRemove: (id: string) => void;
}) {
  if (pins.length === 0) {
    return (
      <p className="text-sm text-white/60">
        No notes yet. Click a spot on the picture.
      </p>
    );
  }
  return (
    <ol className="space-y-3">
      {pins.map((pin, i) => (
        <li
          className={`space-y-2 rounded-md border p-3 ${
            selected === pin.id
              ? "border-white/40 bg-white/4"
              : "border-white/10"
          }`}
          key={pin.id}
        >
          <div className="flex items-center gap-2">
            <button
              className="flex size-7 shrink-0 items-center justify-center rounded-full border border-white/30 font-semibold text-[12px] text-white"
              onClick={() => onSelect(pin.id)}
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
                onUpdate(pin.id, { kind: e.target.value as ReviewPin["kind"] })
              }
              value={pin.kind}
            >
              {PIN_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
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
  );
}
