import { type PointerEvent, useEffect, useState } from "react";
import { newItemId } from "../../../config/proposal.js";
import type { ReviewMark } from "../../../config/review.js";
import type { ReviewTool } from "./ReviewMarkupToolbar";
import { isActiveScreen, isTyping, touchScreen } from "./reviewEditing";

/** A drag shorter than this, as a fraction of the picture, is not a mark. */
const MIN_MARK = 0.01;
/** Pen points closer than this are sub-pixel jitter, skipped. */
const PEN_STEP = 0.002;

/**
 * The markup on one review screen: drawing a mark, erasing one, and editing
 * one after it is drawn (the Edit tool: select it, drag it or its ends,
 * Delete to remove it). Every change that lands is one undo step.
 */
export function useReviewMarkup({
  at,
  marks,
  record,
  screenId,
  setMarks,
  tool,
}: {
  /** Where on the picture, as fractions, a pointer event landed. */
  at: (e: PointerEvent) => { x: number; y: number } | null;
  marks: ReviewMark[];
  /** Records an undo step before a change. */
  record: () => void;
  screenId: string;
  setMarks: (marks: ReviewMark[]) => void;
  tool: ReviewTool;
}) {
  const [draft, setDraft] = useState<ReviewMark | null>(null);
  const [selectedMark, setSelectedMark] = useState<string | null>(null);
  // The selected mark mid-drag, drawn in place of the saved one until release.
  const [preview, setPreview] = useState<ReviewMark | null>(null);

  const step = (next: ReviewMark[]) => {
    record();
    setMarks(next);
  };

  const eraseMark = (id: string) => {
    step(marks.filter((m) => m.id !== id));
    if (selectedMark === id) {
      setSelectedMark(null);
    }
  };

  const clearMarks = () => {
    step([]);
    setSelectedMark(null);
  };

  const commitEdit = (mark: ReviewMark) => {
    setPreview(null);
    step(marks.map((m) => (m.id === mark.id ? mark : m)));
  };

  // Leaving the Edit tool lets go of the selection.
  useEffect(() => {
    if (tool !== "select") {
      setSelectedMark(null);
      setPreview(null);
    }
  }, [tool]);

  // Delete or Backspace removes the selected mark, unless a field has focus.
  useEffect(() => {
    if (!selectedMark) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        !isTyping(e.target) &&
        isActiveScreen(screenId)
      ) {
        e.preventDefault();
        eraseMark(selectedMark);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Drawing: press to start a mark, drag to shape it, release to keep it.
  const startMark = (e: PointerEvent<HTMLDivElement>) => {
    touchScreen(screenId);
    if (
      tool === "pin" ||
      tool === "erase" ||
      tool === "select" ||
      e.button !== 0
    ) {
      return;
    }
    const pos = at(e);
    if (!pos) {
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

  const shapeMark = (e: PointerEvent<HTMLDivElement>) => {
    const pos = at(e);
    if (!(draft && pos)) {
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

  const finishMark = () => {
    if (!draft) {
      return;
    }
    const [a, b] = [draft.points[0], draft.points.at(-1)];
    const span = a && b ? Math.hypot(b[0] - a[0], b[1] - a[1]) : 0;
    // A click without a drag is not a mark.
    if (span > MIN_MARK && draft.points.length >= 2) {
      step([...marks, draft]);
    }
    setDraft(null);
  };

  const editing = marks.find((m) => m.id === selectedMark) ?? null;
  // What clicking a mark does: the eraser removes it, Edit selects it.
  let onMarkClick: ((id: string) => void) | undefined;
  if (tool === "erase") {
    onMarkClick = eraseMark;
  } else if (tool === "select") {
    onMarkClick = setSelectedMark;
  }
  let cursor = "cursor-crosshair";
  if (tool === "erase") {
    cursor = "cursor-cell";
  } else if (tool === "select") {
    cursor = "cursor-default";
  }
  return {
    clearMarks,
    commitEdit,
    /** The canvas cursor for the tool in hand. */
    cursor,
    draft,
    /** The selected mark as it stands, mid-drag included; null for none. */
    editing: preview ?? editing,
    eraseMark,
    finishMark,
    onMarkClick,
    selectedMark,
    setPreview,
    setSelectedMark,
    shapeMark,
    /** The marks to draw: the one being dragged shown where it is now. */
    shown: preview
      ? marks.map((m) => (m.id === preview.id ? preview : m))
      : marks,
    startMark,
  };
}
