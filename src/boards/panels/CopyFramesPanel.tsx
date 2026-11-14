import { HugeiconsIcon } from "@hugeicons/react";
import CopyIcon from "@hugeicons-pro/core-stroke-standard/CopyIcon";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { boardsApi } from "../../services/portfolioService";
import type { Board, BoardItem } from "../../types";
import type { CopyTarget } from "../io/copyToBoard";
import "../boardChrome.css";
import "./CollectionPanel.css";

/**
 * Choosing where frames are copied: any other board, or a new one named.
 *
 * Dressed like the send-to-board panel, since it is the same gesture. The
 * board being edited isn't offered: it has its own unsaved state, and
 * duplicating a frame in place is a separate row.
 */
interface CopyFramesPanelProps {
  /** Everything on this board, for copying the lot. */
  everything: BoardItem[];
  frames: BoardItem[];
  onCancel: () => void;
  onConfirm: (items: BoardItem[], to: CopyTarget) => void;
  summaryOf: (items: BoardItem[]) => { count: number; severed: number };
  /** The new board's suggested name. */
  title: string;
}

const whatOf = (whole: boolean, items: BoardItem[]): string => {
  if (whole) {
    return "the whole board";
  }
  const frames = items.filter((item) => item.kind === "frame").length;
  if (frames === items.length) {
    return frames === 1 ? "the frame" : `${frames} frames`;
  }
  return items.length === 1 ? "it" : `${items.length} items`;
};

export function CopyFramesPanel({
  everything,
  frames,
  onCancel,
  onConfirm,
  summaryOf,
  title,
}: CopyFramesPanelProps) {
  const [whole, setWhole] = useState(false);
  // The whole board copies every item (each one counts as its own "frame"
  // for the copy, so loose ones come too), laid out as it is.
  const going = whole ? everything : frames;
  const summary = summaryOf(going);
  const { boardId: currentId } = useParams<{ boardId: string }>();
  const [boards, setBoards] = useState<Board[] | null>(null);
  const [name, setName] = useState(title);

  useEffect(() => {
    let live = true;
    boardsApi
      .list()
      .then((all) => {
        if (live) {
          setBoards(all.filter((board) => board.id !== currentId));
        }
      })
      .catch(() => {
        if (live) {
          setBoards([]);
        }
      });
    return () => {
      live = false;
    };
  }, [currentId]);

  const what = whatOf(whole, frames);
  const create = () => {
    const named = name.trim();
    if (named) {
      onConfirm(going, { title: named });
    }
  };

  return (
    <div className="collection-panel">
      <div className="collection-panel__header">
        <HugeiconsIcon
          aria-hidden
          className="collection-panel__icon"
          icon={CopyIcon}
          size={14}
        />
        <span className="collection-panel__title">Send {what} to…</span>
      </div>

      <label className="panel-hint">
        <input
          checked={whole}
          onChange={(e) => setWhole(e.target.checked)}
          type="checkbox"
        />{" "}
        Everything on this board ({everything.length} items)
      </label>

      <div className="collection-panel__list">
        {boards === null ? (
          <p className="collection-panel__message">Loading…</p>
        ) : null}
        {boards?.length === 0 ? (
          <p className="collection-panel__message collection-panel__message--wrapped">
            No other boards yet. Name one below.
          </p>
        ) : null}
        {boards?.map((board) => (
          <button
            className="collection-panel__option"
            key={board.id}
            onClick={() =>
              onConfirm(going, { id: board.id, title: board.title })
            }
            type="button"
          >
            <span className="collection-panel__name">{board.title}</span>
            <span className="collection-panel__count">
              {board.itemCount ?? 0}
            </span>
          </button>
        ))}
      </div>

      <p className="panel-hint">
        {summary.count} item{summary.count === 1 ? "" : "s"}, copied. Added to
        the right of what's on that board; this one keeps its own.
        {!whole && summary.severed > 0 ? (
          <span className="panel-warning">
            {summary.severed === 1
              ? "1 wire leaves the frames and will not come across."
              : `${summary.severed} wires leave the frames and will not come across.`}
          </span>
        ) : null}
      </p>

      <div className="collection-panel__create">
        <input
          aria-label="New board name"
          className="collection-panel__create-field"
          name="new-board"
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              create();
            }
            if (event.key === "Escape") {
              onCancel();
            }
          }}
          placeholder="New board…"
          value={name}
        />
        <button
          className="panel-button panel-button--tinted"
          disabled={name.trim().length === 0}
          onClick={create}
          type="button"
        >
          Create
        </button>
      </div>
    </div>
  );
}
