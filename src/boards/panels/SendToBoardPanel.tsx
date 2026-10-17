import { HugeiconsIcon } from "@hugeicons/react";
import ArrowRight02Icon from "@hugeicons-pro/core-stroke-standard/ArrowRight02Icon";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { boardsApi } from "../../services/portfolioService";
import type { Board } from "../../types";
import { measureRaster } from "../io/measureRaster";
import { type SentPicture, sentItems } from "../io/sendToBoard";
import "../boardChrome.css";
import "./CollectionPanel.css";

/**
 * Choosing which board a selection's pictures go to, or naming a new one.
 *
 * The same shape as CollectionPanel, and dressed in its classes, because it is
 * the same gesture with a different destination.
 *
 * A save replaces the whole board, so sending to an existing one reads it,
 * appends, and writes everything back. Wires are left out of the write, which
 * keeps the target's own wiring exactly as stored. If that board is open in
 * another tab, its next autosave wins — the same rule as any two tabs on one
 * board.
 */

interface SendToBoardPanelProps {
  onClose: () => void;
  urls: string[];
}

/** Each picture's real proportions, or none — the item falls back to square. */
const measured = (urls: string[]): Promise<SentPicture[]> =>
  Promise.all(
    urls.map((url) =>
      measureRaster(url)
        .then(({ height, width }) => ({ height, url, width }))
        .catch(() => ({ url }))
    )
  );

export function SendToBoardPanel({ onClose, urls }: SendToBoardPanelProps) {
  const { boardId: currentId } = useParams<{ boardId: string }>();
  const [boards, setBoards] = useState<Board[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

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

  const count = urls.length;
  const what = count === 1 ? "it" : String(count);

  const sendTo = async (target: Board, fresh: boolean) => {
    setBusy(true);
    try {
      const pictures = await measured(urls);
      const existing = fresh
        ? []
        : ((await boardsApi.get(target.id)).items ?? []);
      await boardsApi.update(target.id, {
        items: [...existing, ...sentItems(pictures, existing)],
      });
      toast.success(`Sent ${what} to "${target.title}"`, {
        action: {
          label: "Open",
          onClick: () => window.open(`/admin/boards/${target.id}`, "_blank"),
        },
      });
      onClose();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not send to that board"
      );
      setBusy(false);
    }
  };

  const createAndSend = async () => {
    const title = name.trim();
    if (!title) {
      return;
    }
    setBusy(true);
    try {
      const created = await boardsApi.create(title);
      await sendTo(created, true);
    } catch (e) {
      setBusy(false);
      toast.error(
        e instanceof Error ? e.message : "Could not create the board"
      );
    }
  };

  return (
    <div className="collection-panel">
      <div className="collection-panel__header">
        <HugeiconsIcon
          aria-hidden
          className="collection-panel__icon"
          icon={ArrowRight02Icon}
          size={14}
        />
        <span className="collection-panel__title">Send {what} to…</span>
      </div>

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
            disabled={busy}
            key={board.id}
            onClick={() => void sendTo(board, false)}
            type="button"
          >
            <span className="collection-panel__name">{board.title}</span>
            <span className="collection-panel__count">
              {board.itemCount ?? 0}
            </span>
          </button>
        ))}
      </div>

      <div className="collection-panel__create">
        <input
          aria-label="New board name"
          autoFocus={boards?.length === 0}
          className="collection-panel__create-field"
          disabled={busy}
          name="new-board"
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void createAndSend();
            }
          }}
          placeholder="New board…"
          value={name}
        />
        <button
          className="panel-button panel-button--tinted"
          disabled={busy || name.trim().length === 0}
          onClick={() => void createAndSend()}
          type="button"
        >
          Send
        </button>
      </div>
    </div>
  );
}
