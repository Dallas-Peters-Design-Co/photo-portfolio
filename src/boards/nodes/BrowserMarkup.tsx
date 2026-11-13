import {
  ArrowUpRight,
  Eraser,
  Highlighter,
  MapPin,
  PenLine,
  Square,
} from "lucide-react";
import { type PointerEvent, useRef, useState } from "react";
import type { BrowserCapture } from "../../../config/nodes/browser.js";
import { newItemId } from "../../../config/proposal.js";
import {
  type MarkKind,
  PIN_KINDS,
  PIN_LABELS,
  type PinKind,
  type ReviewMark,
  type ReviewPin,
} from "../../../config/review.js";
import {
  ReviewMarks,
  reviewPinClass,
} from "../../components/review/ReviewMarkup";

/**
 * Markup on a browser node's screenshot, and its numbered notes.
 *
 * The same marks and pins a review screen has (config/review.ts), drawn by
 * the same component the client's page uses, so what's drawn on the board
 * is what the review shows. Notes stack in a column outside the node, to the
 * right, numbered to match their pins; each is edited in place.
 */

export type MarkupTool = "pin" | "erase" | MarkKind;

export const MARKUP_TOOLS: {
  hint: string;
  icon: typeof MapPin;
  id: MarkupTool;
}[] = [
  { hint: "Note: click to pin a numbered note", icon: MapPin, id: "pin" },
  { hint: "Box: drag around something", icon: Square, id: "box" },
  {
    hint: "Highlight: drag to tint an area",
    icon: Highlighter,
    id: "highlight",
  },
  { hint: "Arrow: drag from tail to tip", icon: ArrowUpRight, id: "arrow" },
  { hint: "Pen: draw freehand", icon: PenLine, id: "pen" },
  {
    hint: "Eraser: click a mark or note to remove it",
    icon: Eraser,
    id: "erase",
  },
];

export interface MarkupPatch {
  marks?: ReviewMark[];
  notes?: ReviewPin[];
}

/** The tool buttons, for the node's bar. */
export function MarkupTools({
  onTool,
  tool,
}: {
  onTool: (tool: MarkupTool) => void;
  tool: MarkupTool;
}) {
  return (
    <div
      aria-label="Markup tools"
      className="browser-node__tools"
      role="toolbar"
    >
      {MARKUP_TOOLS.map(({ hint, icon: Icon, id }) => (
        <button
          aria-label={hint}
          aria-pressed={tool === id}
          className="browser-node__tool"
          key={id}
          onClick={() => onTool(id)}
          onPointerDown={(e) => e.stopPropagation()}
          title={hint}
          type="button"
        >
          <Icon aria-hidden size={14} />
        </button>
      ))}
    </div>
  );
}

const MIN_MARK = 0.01;
const PEN_STEP = 0.002;

export function BrowserMarkup({
  capture,
  marks,
  notes,
  onChange,
  onSelectNote,
  readOnly,
  selected,
  tool,
}: {
  capture: BrowserCapture;
  marks: ReviewMark[];
  notes: ReviewPin[];
  onChange: (patch: MarkupPatch) => void;
  onSelectNote: (id: string | null) => void;
  readOnly: boolean;
  selected: string | null;
  tool: MarkupTool;
}) {
  const surface = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<ReviewMark | null>(null);
  const moving = useRef<string | null>(null);
  const moved = useRef<boolean>(false);

  const at = (e: { clientX: number; clientY: number }) => {
    const rect = surface.current?.getBoundingClientRect();
    if (!(rect?.width && rect.height)) {
      return null;
    }
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  };

  const press = (e: PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (readOnly || e.button !== 0) {
      return;
    }
    const pos = at(e);
    if (!pos) {
      return;
    }
    if (tool === "pin") {
      const pin: ReviewPin = {
        body: "",
        id: newItemId(),
        kind: "issue",
        title: "",
        x: pos.x,
        y: pos.y,
      };
      onChange({ notes: [...notes, pin] });
      onSelectNote(pin.id);
      return;
    }
    if (tool === "erase") {
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraft({
      id: newItemId(),
      kind: tool,
      points: [
        [pos.x, pos.y],
        [pos.x, pos.y],
      ],
    });
  };

  const drag = (e: PointerEvent<HTMLDivElement>) => {
    const pos = at(e);
    if (!pos) {
      return;
    }
    if (moving.current) {
      moved.current = true;
      const id = moving.current;
      onChange({
        notes: notes.map((n) => (n.id === id ? { ...n, ...pos } : n)),
      });
      return;
    }
    if (!draft) {
      return;
    }
    const point: [number, number] = [pos.x, pos.y];
    if (draft.kind === "pen") {
      const last = draft.points.at(-1) ?? point;
      if (Math.hypot(point[0] - last[0], point[1] - last[1]) > PEN_STEP) {
        setDraft({ ...draft, points: [...draft.points, point] });
      }
      return;
    }
    setDraft({ ...draft, points: [draft.points[0] ?? point, point] });
  };

  const release = () => {
    moving.current = null;
    if (!draft) {
      return;
    }
    const [a, b] = [draft.points[0], draft.points.at(-1)];
    const span = a && b ? Math.hypot(b[0] - a[0], b[1] - a[1]) : 0;
    // A click without a drag is not a mark.
    if (span > MIN_MARK) {
      onChange({ marks: [...marks, draft] });
    }
    setDraft(null);
  };

  const erase = (id: string) =>
    onChange({ marks: marks.filter((m) => m.id !== id) });

  return (
    <div
      className={`browser-node__surface browser-node__surface--${tool}`}
      onPointerDown={press}
      onPointerMove={drag}
      onPointerUp={release}
      ref={surface}
    >
      <img
        alt="Screenshot"
        className="browser-node__shot"
        draggable={false}
        height={capture.height}
        src={capture.url}
        width={capture.width}
      />
      <ReviewMarks
        draft={draft}
        height={capture.height}
        marks={marks}
        onSelect={tool === "erase" && !readOnly ? erase : undefined}
        width={capture.width}
      />
      {notes.map((note, i) => (
        <button
          aria-label={`Note ${i + 1}`}
          className={`${reviewPinClass(note.kind)} ${selected === note.id ? "browser-node__pin--selected" : ""}`}
          key={note.id}
          onClick={(e) => {
            e.stopPropagation();
            if (moved.current) {
              moved.current = false;
              return;
            }
            if (tool === "erase" && !readOnly) {
              onChange({ notes: notes.filter((n) => n.id !== note.id) });
            } else {
              onSelectNote(note.id);
            }
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            if (!readOnly && tool !== "erase" && e.button === 0) {
              moving.current = note.id;
              moved.current = false;
              surface.current?.setPointerCapture(e.pointerId);
            }
          }}
          style={{ left: `${note.x * 100}%`, top: `${note.y * 100}%` }}
          type="button"
        >
          {i + 1}
        </button>
      ))}
    </div>
  );
}

/** The numbered notes, stacked beside the node, each edited where it sits. */
export function BrowserNotes({
  notes,
  onChange,
  onSelect,
  readOnly,
  selected,
}: {
  notes: ReviewPin[];
  onChange: (notes: ReviewPin[]) => void;
  onSelect: (id: string | null) => void;
  readOnly: boolean;
  selected: string | null;
}) {
  if (notes.length === 0) {
    return null;
  }
  const update = (id: string, next: Partial<ReviewPin>) =>
    onChange(notes.map((n) => (n.id === id ? { ...n, ...next } : n)));
  return (
    <ol className="browser-node__notes">
      {notes.map((note, i) => (
        <li
          className={`browser-node__note ${selected === note.id ? "browser-node__note--selected" : ""}`}
          key={note.id}
          onPointerDown={(e) => {
            e.stopPropagation();
            onSelect(note.id);
          }}
        >
          <div className="browser-node__note-head">
            <span className={reviewPinClass(note.kind)}>{i + 1}</span>
            <select
              aria-label={`Kind of note ${i + 1}`}
              className="browser-node__note-kind"
              disabled={readOnly}
              onChange={(e) =>
                update(note.id, { kind: e.target.value as PinKind })
              }
              value={note.kind}
            >
              {PIN_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {PIN_LABELS[kind]}
                </option>
              ))}
            </select>
            {readOnly ? null : (
              <button
                aria-label={`Remove note ${i + 1}`}
                className="browser-node__note-remove"
                onClick={() => onChange(notes.filter((n) => n.id !== note.id))}
                type="button"
              >
                ×
              </button>
            )}
          </div>
          <input
            aria-label={`Title of note ${i + 1}`}
            className="browser-node__note-title"
            onChange={(e) => update(note.id, { title: e.target.value })}
            placeholder="What's the note?"
            readOnly={readOnly}
            value={note.title}
          />
          <textarea
            aria-label={`Note ${i + 1}`}
            className="browser-node__note-body"
            onChange={(e) => update(note.id, { body: e.target.value })}
            placeholder="Details, and what to do about it"
            readOnly={readOnly}
            rows={3}
            value={note.body}
          />
        </li>
      ))}
    </ol>
  );
}
