import { HugeiconsIcon } from "@hugeicons/react";
import DashboardSquare01Icon from "@hugeicons-pro/core-stroke-standard/DashboardSquare01Icon";
import { type RefObject, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { sendReviewToBoard } from "../../boards/review/sendToBoard";
import type { ReviewRecord } from "../../services/reviewService";
import { Button } from "../ui/button";

/**
 * "Send to board" in the review editor: the review's screens become Browser
 * nodes on a board, to be worked on there (src/boards/review/sendToBoard.ts).
 * The board's id goes on the draft, which saves itself, so the board and the
 * review stay linked both ways.
 */
export function ReviewBoardSync({
  boardId,
  latest,
  onLinked,
}: {
  boardId: string | null;
  latest: RefObject<ReviewRecord>;
  onLinked: (boardId: string) => void;
}) {
  const navigate = useNavigate();
  const [isSending, setIsSending] = useState(false);
  const openBoard = (id: string) => navigate(`/admin/boards/${id}`);

  const send = async () => {
    const review = latest.current;
    if (!review.doc.screens.some((s) => s.image)) {
      toast.error("Capture or upload a screen first.");
      return;
    }
    setIsSending(true);
    try {
      const board = await sendReviewToBoard(review);
      onLinked(board.id);
      toast.success(boardId ? "Board updated" : "Board made from the review", {
        action: { label: "Open board", onClick: () => openBoard(board.id) },
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not send the review"
      );
    } finally {
      setIsSending(false);
    }
  };

  let label = boardId ? "Update board" : "Send to board";
  if (isSending) {
    label = "Sending…";
  }

  return (
    <>
      <Button
        disabled={isSending}
        onClick={() => void send()}
        title="Each screen becomes a Browser node, with its markup and notes"
        type="button"
        variant="ghost"
      >
        <HugeiconsIcon icon={DashboardSquare01Icon} size={14} />
        {label}
      </Button>
      {boardId ? (
        <Button
          onClick={() => openBoard(boardId)}
          type="button"
          variant="ghost"
        >
          Open board
        </Button>
      ) : null}
    </>
  );
}
