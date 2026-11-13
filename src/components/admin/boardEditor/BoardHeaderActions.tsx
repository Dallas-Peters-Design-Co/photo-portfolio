import Cancel01Icon from "@hugeicons-pro/core-stroke-standard/Cancel01Icon";
import Comment01Icon from "@hugeicons-pro/core-stroke-standard/Comment01Icon";
import Globe02Icon from "@hugeicons-pro/core-stroke-standard/Globe02Icon";
import Link01Icon from "@hugeicons-pro/core-stroke-standard/Link01Icon";
import PlayIcon from "@hugeicons-pro/core-stroke-standard/PlayIcon";
import Presentation01Icon from "@hugeicons-pro/core-stroke-standard/Presentation01Icon";
import StopIcon from "@hugeicons-pro/core-stroke-standard/StopIcon";
import { toast } from "sonner";
import ThemeToggle from "../../ThemeToggle";
import "./boardEditorChrome.css";
import type { Board, BoardItem } from "../../../types";
import { FrameLinks } from "./FrameLinks";
import { HeaderIcon } from "./HeaderIcon";
import { PublishReview } from "./PublishReview";

/** Strips the scheme so the shared link reads as a plain address. */
const SCHEME = /^https?:\/\//;

/** The board header's actions: run, comment, share, publish, close. */
export function BoardHeaderActions({
  board = null,
  commentCount,
  hasNodes,
  // Read off the board when it's given.
  isPublic = board?.isPublic ?? false,
  isPublishing,
  isRunning,
  onCancelRun,
  onClose,
  onPublish,
  onRun,
  onToggleComments,
  items,
  publicUrl,
  showComments,
}: {
  /** The board, for the review its browser nodes publish to. */
  board?: Board | null;
  commentCount: number;
  hasNodes: boolean;
  isPublic?: boolean;
  isPublishing: boolean;
  isRunning: boolean;
  onCancelRun: () => void;
  onClose: () => void;
  onPublish: () => void;
  onRun: () => void;
  onToggleComments: () => void;
  /** The board's items, so each frame can offer its link. */
  items: BoardItem[];
  publicUrl: string | null;
  showComments: boolean;
}) {
  return (
    <>
      {/* Only offered once there is a graph to run. A board of pinned
          photographs has nothing to execute, and a control that would always
          be a no-op is noise. */}
      {hasNodes ? (
        <HeaderIcon
          icon={isRunning ? StopIcon : PlayIcon}
          label={isRunning ? "Cancel the run" : "Run the board"}
          onClick={isRunning ? onCancelRun : onRun}
        />
      ) : null}
      <HeaderIcon
        badge={commentCount}
        icon={Comment01Icon}
        label={showComments ? "Hide comments" : "Comments"}
        onClick={onToggleComments}
        pressed={showComments}
      />
      {publicUrl ? (
        <HeaderIcon
          className="board-header-icon--live"
          icon={Link01Icon}
          label={`Copy the link: ${publicUrl.replace(SCHEME, "")}`}
          onClick={() => {
            void navigator.clipboard.writeText(publicUrl);
            toast.success("Link copied");
          }}
        />
      ) : null}
      {/* Each frame's own link, beside the board's. See FrameLinks on why it
          cannot live on the frame itself. */}
      <FrameLinks boardUrl={publicUrl} items={items} />
      {publicUrl ? (
        <HeaderIcon
          icon={Presentation01Icon}
          label="Present"
          onClick={() => window.open(`${publicUrl}/present`, "_blank")}
        />
      ) : null}
      {/* Browser nodes' screenshots, as a review for a client. Only once one
          has been taken. */}
      <PublishReview board={board} items={items} />
      <HeaderIcon
        className={isPublic ? "board-header-icon--live" : ""}
        disabled={isPublishing}
        icon={Globe02Icon}
        label={isPublic ? "Published · click to unpublish" : "Publish"}
        onClick={onPublish}
        pressed={isPublic}
      />
      <ThemeToggle iconOnly />
      <HeaderIcon icon={Cancel01Icon} label="Close board" onClick={onClose} />
    </>
  );
}
