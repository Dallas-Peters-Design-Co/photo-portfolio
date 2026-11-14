import { HugeiconsIcon } from "@hugeicons/react";
import EyeIcon from "@hugeicons-pro/core-stroke-standard/EyeIcon";
import FloppyDiskIcon from "@hugeicons-pro/core-stroke-standard/FloppyDiskIcon";
import ViewOffIcon from "@hugeicons-pro/core-stroke-standard/ViewOffIcon";
import type { RefObject } from "react";
import type { ReviewRecord } from "../../services/reviewService";
import { Button } from "../ui/button";
import { ReviewBoardSync } from "./ReviewBoardSync";

export type SaveState = "saved" | "saving" | "unsaved" | "failed";

const SAVE_LABELS: Record<SaveState, string> = {
  failed: "Couldn't save — try Save",
  saved: "All changes saved",
  saving: "Saving…",
  unsaved: "Unsaved changes",
};

const quietAction =
  "text-micro-xs text-white/90 uppercase tracking-micro-wide transition-colors hover:text-white disabled:cursor-progress disabled:text-white/50";

/**
 * The review editor's last row: save, publish, send to its board, where the
 * draft stands, and the preview and PDF.
 */
export function ReviewEditorActions({
  draft,
  isPrinting,
  isSaving,
  latest,
  onLinkBoard,
  onPreview,
  onPrint,
  onSave,
  saveState,
}: {
  draft: ReviewRecord;
  isPrinting: boolean;
  isSaving: boolean;
  latest: RefObject<ReviewRecord>;
  onLinkBoard: (boardId: string) => void;
  onPreview: () => void;
  onPrint: () => void;
  onSave: (overrides?: Partial<ReviewRecord>) => void;
  saveState: SaveState;
}) {
  const isPublished = draft.status === "published";
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        disabled={isSaving}
        onClick={() => onSave()}
        type="button"
        variant="outline"
      >
        <HugeiconsIcon icon={FloppyDiskIcon} size={14} />
        {isSaving ? "Saving…" : "Save"}
      </Button>
      <Button
        disabled={isSaving}
        onClick={() => onSave({ status: isPublished ? "draft" : "published" })}
        type="button"
        variant="ghost"
      >
        <HugeiconsIcon icon={isPublished ? EyeIcon : ViewOffIcon} size={14} />
        {isPublished ? "Unpublish" : "Publish"}
      </Button>
      <ReviewBoardSync
        boardId={draft.doc.boardId}
        latest={latest}
        onLinked={onLinkBoard}
      />
      <span
        className={`text-micro-xs uppercase tracking-micro-wide ${
          isPublished ? "text-emerald-400/70" : "text-amber-400/70"
        }`}
      >
        {draft.status}
      </span>
      <span
        aria-live="polite"
        className={`text-micro-sm ${
          saveState === "failed" ? "text-red-300" : "text-white/55"
        }`}
      >
        {SAVE_LABELS[saveState]}
      </span>
      <button
        className={`ml-auto ${quietAction}`}
        disabled={isSaving}
        onClick={onPreview}
        type="button"
      >
        Preview
      </button>
      <button
        className={quietAction}
        disabled={isPrinting || isSaving}
        onClick={onPrint}
        type="button"
      >
        {isPrinting ? "Preparing PDF…" : "PDF"}
      </button>
    </div>
  );
}
