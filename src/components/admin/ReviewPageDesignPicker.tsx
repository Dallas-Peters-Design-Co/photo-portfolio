import { useEffect, useState } from "react";
import type { PageDesign } from "../../../config/pageDesign.js";
import { pageDesignOf } from "../../../config/pageDesign.js";
import { boardsApi } from "../../services/portfolioService";
import type { Board, BoardItem } from "../../types";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

interface DesignedPage {
  frame: BoardItem;
  page: PageDesign;
}

export interface DesignedPageSelection {
  board: Board;
  frame: BoardItem;
  page: PageDesign;
}

const designedPagesOf = (items: BoardItem[]): DesignedPage[] =>
  items.flatMap((frame) => {
    const page = frame.kind === "frame" ? pageDesignOf(frame.config) : null;
    return page ? [{ frame, page }] : [];
  });

export function ReviewPageDesignPicker({
  onAdd,
}: {
  onAdd: (selection: DesignedPageSelection) => void;
}) {
  const [open, setOpen] = useState(false);
  const [boards, setBoards] = useState<Board[]>([]);
  const [boardId, setBoardId] = useState("");
  const [pages, setPages] = useState<DesignedPage[]>([]);
  const [pageId, setPageId] = useState("");
  const [loadingBoards, setLoadingBoards] = useState(false);
  const [loadingPages, setLoadingPages] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || boards.length > 0) {
      return;
    }
    let cancelled = false;
    setLoadingBoards(true);
    void boardsApi
      .list()
      .then((result) => {
        if (!cancelled) {
          setBoards(result);
          setError(result.length === 0 ? "No boards found." : "");
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(
            reason instanceof Error ? reason.message : "Could not load boards."
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingBoards(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [boards.length, open]);

  useEffect(() => {
    if (!(open && boardId)) {
      setPages([]);
      setPageId("");
      return;
    }
    let cancelled = false;
    setLoadingPages(true);
    setPages([]);
    setPageId("");
    void boardsApi
      .get(boardId)
      .then((board) => {
        if (!cancelled) {
          const designs = designedPagesOf(board.items ?? []);
          setPages(designs);
          setError(
            designs.length === 0 ? "This board has no designed frames." : ""
          );
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(
            reason instanceof Error ? reason.message : "Could not load pages."
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingPages(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [boardId, open]);

  const addPage = () => {
    const board = boards.find((candidate) => candidate.id === boardId);
    const design = pages.find((candidate) => candidate.frame.id === pageId);
    if (!(board && design)) {
      return;
    }
    onAdd({ board, frame: design.frame, page: design.page });
    setOpen(false);
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} type="button" variant="outline">
        Add designed screen
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a designed screen</DialogTitle>
            <DialogDescription>
              Choose a board and a designed frame to add it as a live page in
              this review.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Select
              disabled={loadingBoards || boards.length === 0}
              items={boards.map((board) => ({
                label: board.title || "Untitled board",
                value: board.id,
              }))}
              onValueChange={(value) => {
                setBoardId(value ?? "");
                setError("");
              }}
              value={boardId}
            >
              <SelectTrigger aria-label="Board">
                <SelectValue
                  placeholder={
                    loadingBoards ? "Loading boards…" : "Choose a board"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {boards.map((board) => (
                  <SelectItem key={board.id} value={board.id}>
                    {board.title || "Untitled board"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {boardId ? (
              <Select
                disabled={loadingPages || pages.length === 0}
                items={pages.map(({ frame }) => ({
                  label: frame.body || "Untitled page",
                  value: frame.id,
                }))}
                onValueChange={(value) => {
                  setPageId(value ?? "");
                  setError("");
                }}
                value={pageId}
              >
                <SelectTrigger aria-label="Designed frame">
                  <SelectValue
                    placeholder={
                      loadingPages
                        ? "Loading pages…"
                        : "Choose a designed frame"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {pages.map(({ frame }) => (
                    <SelectItem key={frame.id} value={frame.id}>
                      {frame.body || "Untitled page"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            {error ? (
              <p className="text-muted-foreground text-sm" role="status">
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              onClick={() => setOpen(false)}
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button
              disabled={!pageId || loadingPages}
              onClick={addPage}
              type="button"
            >
              Add page
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
