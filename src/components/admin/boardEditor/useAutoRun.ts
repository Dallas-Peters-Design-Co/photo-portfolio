import { useEffect, useRef } from "react";
import type { BoardItem } from "../../../types";

/**
 * Run the board once on load when the URL says `?run=1`.
 *
 * The cover pipeline seeds a board from InDesign and then opens it, and every
 * one of those boards exists to be run — stopping to press Run is a step that
 * only ever has one answer. The flag lets whatever opened the board say so.
 *
 * Lives here rather than in BoardEditor.tsx, which sits exactly on the 500-line
 * ceiling and has no room for a call site.
 */
export const useAutoRun = ({
  isRunning,
  items,
  runBoard,
}: {
  isRunning: boolean;
  items: BoardItem[];
  runBoard: () => Promise<void>;
}) => {
  /** Once per mount, not once per render. */
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current || isRunning) {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get("run") !== "1") {
      return;
    }
    // Gated exactly like the Run button, which only renders when
    // items.some(kind === "op"): a board of pinned photographs has nothing to
    // execute. It doubles as the load check — items starts empty, so an op
    // node existing is proof the board has arrived, and running before that
    // would run nothing and spend the one shot.
    if (!items.some((item) => item.kind === "op")) {
      return;
    }
    didRun.current = true;
    // Strip the flag so a refresh does not run it again. replaceState rather
    // than navigate(): the editor does not own the route, and a router
    // navigation here would remount it mid-run.
    params.delete("run");
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (query ? `?${query}` : "")
    );
    void runBoard();
  }, [isRunning, items, runBoard]);
};
