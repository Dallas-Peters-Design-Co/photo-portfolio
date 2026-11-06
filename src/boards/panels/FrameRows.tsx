import { HugeiconsIcon } from "@hugeicons/react";
import CopyIcon from "@hugeicons-pro/core-stroke-standard/CopyIcon";
import Download01Icon from "@hugeicons-pro/core-stroke-standard/Download01Icon";
import GridIcon from "@hugeicons-pro/core-stroke-standard/GridIcon";
import SparklesIcon from "@hugeicons-pro/core-stroke-standard/SparklesIcon";
import type { BoardItem } from "../../types";
import "../boardChrome.css";

const rowClass = "panel-row";

/** The frames a copy takes: all the selected ones, if this is one of them. */
export const framesToCopy = (
  frame: BoardItem | null | undefined,
  selection: BoardItem[]
): BoardItem[] => {
  if (!frame) {
    return [];
  }
  const selected = selection.filter((item) => item.kind === "frame");
  return selected.some((f) => f.id === frame.id) ? selected : [frame];
};

/** The things a frame under the pointer can do. */
export function FrameRows({
  canArrange,
  canGroup,
  count,
  copies,
  onArrange,
  onCopy,
  onExport,
  onTrain,
}: {
  canArrange: boolean;
  /** How many frames the copy row takes. */
  copies: number;
  canGroup: boolean;
  count: number;
  onArrange: () => void;
  onCopy: () => void;
  onExport: () => void;
  /** Absent on a board that cannot hand the frame to a trainer. */
  onTrain?: () => void;
}) {
  return (
    <>
      {canArrange ? (
        <button
          className={`${rowClass} ${canGroup ? "panel-row--divided" : ""}`}
          onClick={onArrange}
          type="button"
        >
          <HugeiconsIcon aria-hidden icon={GridIcon} size={14} />
          <span>Arrange {count} into a grid</span>
        </button>
      ) : null}
      <button
        className={`${rowClass} ${canGroup || canArrange ? "panel-row--divided" : ""}`}
        onClick={onExport}
        type="button"
      >
        <HugeiconsIcon aria-hidden icon={Download01Icon} size={14} />
        <span>Download {count === 1 ? "it" : `all ${count}`}</span>
      </button>
      <button
        className={`${rowClass} panel-row--divided`}
        onClick={onCopy}
        type="button"
      >
        <HugeiconsIcon aria-hidden icon={CopyIcon} size={14} />
        <span>
          Copy {copies === 1 ? "frame" : `${copies} frames`} to another board…
        </span>
      </button>
      {/* Last, and divided: it is the only row here that hands work to a
          third party, so it should not sit next to the local ones. */}
      {onTrain ? (
        <button
          className={`${rowClass} panel-row--divided`}
          onClick={onTrain}
          type="button"
        >
          <HugeiconsIcon aria-hidden icon={SparklesIcon} size={14} />
          <span>Train a model on this frame</span>
        </button>
      ) : null}
    </>
  );
}
