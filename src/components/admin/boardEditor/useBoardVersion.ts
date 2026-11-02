import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { StaleBoardError } from "../../../services/boardSave";
import { boardsApi } from "../../../services/portfolioService";
import type { Board, BoardItem, BoardWire } from "../../../types";

/**
 * Which version of the board this window is editing, so an out-of-date copy
 * can never save over newer work.
 *
 * Every save replaces the whole arrangement. A second tab or window left open
 * on the same board used to save its own older copy whenever it was switched
 * away from, and that put back positions, mosaics and layers from hours
 * before. Now each save says which version (the board's updatedAt) it was
 * made from, and the server refuses one that is behind (409). When that
 * happens this window stops saving and says so, with a Reload to fetch the
 * latest.
 *
 * This window's own requests can overlap (a save still in flight when the tab
 * is hidden and flushes), and then the second to land looks behind the first
 * through no fault of anyone's. A refusal for a request that overlapped
 * another of ours re-reads the version and tries once more instead.
 */

type ArrangementSave = Parameters<typeof boardsApi.update>[1];

const STALE_TOAST = "board-stale";

/** Whether a failed request overlapped another of this window's. */
const overlapped = (err: unknown) =>
  Boolean((err as { overlapped?: boolean } | null)?.overlapped);

const later = (a: string | null | undefined, b: string) =>
  a && Date.parse(a) > Date.parse(b) ? a : b;

export const useBoardVersion = (boardId: string) => {
  /** undefined: not loaded yet. null: out of date, no longer saving. */
  const version = useRef<string | null | undefined>(undefined);
  const [isStale, setIsStale] = useState(false);
  const inFlight = useRef(0);
  const started = useRef(0);

  /** Takes the version from a response, never stepping backwards. */
  const adopt = useCallback((board: Pick<Board, "updatedAt">) => {
    if (version.current !== null && board.updatedAt) {
      version.current = later(version.current, board.updatedAt);
    }
  }, []);

  const markStale = useCallback(() => {
    version.current = null;
    setIsStale(true);
    toast.error("This board was changed in another tab or window", {
      action: { label: "Reload", onClick: () => window.location.reload() },
      description:
        "Changes here have stopped saving so they can't undo the newer work. Reload to pick up the latest.",
      duration: Number.POSITIVE_INFINITY,
      id: STALE_TOAST,
    });
  }, []);

  /** Runs a request, noting whether another of ours overlapped it. */
  const tracked = useCallback(async <T>(send: () => Promise<T>) => {
    const busyAtStart = inFlight.current > 0;
    started.current += 1;
    const mine = started.current;
    inFlight.current += 1;
    try {
      return { overlapped: busyAtStart, result: await send() };
    } catch (err) {
      if (err instanceof Error) {
        Object.assign(err, {
          overlapped: busyAtStart || started.current !== mine,
        });
      }
      throw err;
    } finally {
      inFlight.current -= 1;
    }
  }, []);

  /**
   * Saves the arrangement from this version. Resolves false, without
   * throwing, when this copy turned out to be out of date.
   */
  const saveArrangement = useCallback(
    async (input: ArrangementSave): Promise<boolean> => {
      const send = () =>
        tracked(() =>
          boardsApi.update(boardId, {
            ...input,
            baseUpdatedAt: version.current ?? null,
          })
        );
      if (version.current === null) {
        return false;
      }
      try {
        adopt((await send()).result);
        return true;
      } catch (err) {
        if (!(err instanceof StaleBoardError)) {
          throw err;
        }
        if (!overlapped(err)) {
          markStale();
          return false;
        }
      }
      // Refused only because our own requests crossed: re-read and retry once.
      const fresh = await boardsApi.get(boardId);
      version.current = fresh.updatedAt;
      try {
        adopt((await send()).result);
        return true;
      } catch (err) {
        if (err instanceof StaleBoardError) {
          markStale();
          return false;
        }
        throw err;
      }
    },
    [adopt, boardId, markStale, tracked]
  );

  /**
   * The flush as a tab is hidden or closed. When the page lives on (a hidden
   * tab), its answer is read too, so the next save starts from the version
   * the flush made rather than looking behind it.
   */
  const flushArrangement = useCallback(
    (items: BoardItem[], wires: BoardWire[]): Promise<void> => {
      if (version.current === null) {
        return Promise.resolve();
      }
      const base = version.current ?? null;
      return tracked(() => boardsApi.flush(boardId, items, wires, base))
        .then(({ result }) => {
          if (result) {
            adopt(result);
          }
        })
        .catch((err: unknown) => {
          if (err instanceof StaleBoardError && !overlapped(err)) {
            markStale();
          }
        });
    },
    [adopt, boardId, markStale, tracked]
  );

  /**
   * A rename or publish. Not checked (it carries no arrangement), but it does
   * move the version on, so it counts as one of ours for an overlapping save.
   */
  const updateDetails = useCallback(
    async (input: Pick<ArrangementSave, "isPublic" | "title">) => {
      const { result } = await tracked(() => boardsApi.update(boardId, input));
      adopt(result);
      return result;
    },
    [adopt, boardId, tracked]
  );

  return {
    flushArrangement,
    isStale,
    saveArrangement,
    updateDetails,
    version,
  };
};
