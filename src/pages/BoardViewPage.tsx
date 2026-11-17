import "./BoardViewPage.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { frameForSlug, frameSlugs } from "../../config/frameSlug";
import { containedBy } from "../../config/graph";
import { nodeTypeFor } from "../../config/nodeTypes";
import { BoardCanvas } from "../boards/BoardCanvas";
import { FrameOpenProvider, frameLink } from "../boards/FrameOpenContext";
import { FrameViewer } from "../boards/FrameViewer";
import { isDesignFrame } from "../boards/geometry/frameLock";
import { downloadableFrames, frameFiles } from "../boards/io/downloadFrames";
import { downloadBlob, downloadNamed } from "../boards/io/downloadImage";
import { renderFrameAt } from "../boards/io/frameRender";
import { currentFrameRender, frameKeyOf } from "../boards/io/frameRenderKey";
import { currentImageUrl } from "../boards/itemOutput";
import { CommentDialog } from "../boards/panels/CommentDialog";
import { CommentsPanel } from "../boards/panels/CommentsPanel";
import { ShareButtons } from "../components/ShareButtons";
import { zip } from "../lib/zip";
import { type BoardComment, commentsApi } from "../services/comments";
import { boardsApi } from "../services/portfolioService";
import { useSiteSettings } from "../theme/SiteSettingsProvider";
import type { Board, BoardItem, BoardWire } from "../types";
import { DownloadFramesMenu } from "./DownloadFramesMenu";

const NOT_SLUG = /[^a-z0-9]+/g;
const NO_WIRES: BoardWire[] = [];

/**
 * A designed frame as one picture, saved: drawn here as the editor draws it,
 * at twice its size, so type and shapes stay sharp (renderFrameAt). The
 * stored render is the frame's own size, made for the nodes it feeds.
 */
const downloadFrame = async (frame: BoardItem, items: BoardItem[]) => {
  const name = frame.body?.trim() || "Frame";
  const id = toast.loading("Preparing the image…");
  try {
    downloadBlob(await renderFrameAt(frame, items), name);
    toast.dismiss(id);
  } catch {
    toast.error("Couldn't draw that frame. Try again in a moment.", { id });
  }
};

/** Every designed frame as PNG and SVG, in one zip, at `density` × size. */
const downloadAllFrames = async (board: Board, density: number) => {
  const items = board.items ?? [];
  const id = toast.loading("Preparing the frames…");
  try {
    const { failed, files } = await frameFiles(
      items,
      (done, total) =>
        toast.loading(
          `Preparing frame ${Math.min(done + 1, total)} of ${total}…`,
          { id }
        ),
      downloadableFrames(items),
      density
    );
    if (files.length === 0) {
      toast.error("Couldn't draw the frames. Try again in a moment.", { id });
      return;
    }
    downloadNamed(zip(files), `${slugOrTitle(board)}-frames@${density}x.zip`);
    toast.success(
      failed.length > 0
        ? `Downloaded. Couldn't draw: ${failed.join(", ")}.`
        : "Frames downloaded",
      { id }
    );
  } catch {
    toast.error("Couldn't prepare the frames. Try again in a moment.", { id });
  }
};

const slugOrTitle = (board: Board): string =>
  board.slug ||
  board.title.toLowerCase().replace(NOT_SLUG, "-").slice(0, 60) ||
  "board";

const itemLabel = (item: BoardItem | undefined): string => {
  if (!item) {
    return "this item";
  }
  if (item.kind === "op") {
    return nodeTypeFor(item.nodeType)?.label ?? "this node";
  }
  return "this image";
};

/** The public page's actions: comment mode, the sidebar, and sharing. */
function PublishedActions({
  board,
  commentMode,
  commentCount,
  onToggleCommentMode,
  onToggleComments,
}: {
  board: Board;
  commentMode: boolean;
  commentCount: number;
  onToggleCommentMode: () => void;
  onToggleComments: () => void;
}) {
  const { settings } = useSiteSettings();
  const frameCount = downloadableFrames(board.items ?? []).length;
  return (
    <div className="row">
      {frameCount > 0 ? (
        <DownloadFramesMenu
          count={frameCount}
          onPick={(density) => void downloadAllFrames(board, density)}
        />
      ) : null}
      <button
        className={
          commentMode
            ? "board-view-page__action board-view-page__action--armed"
            : "board-view-page__action"
        }
        onClick={onToggleCommentMode}
        type="button"
      >
        {commentMode ? "Cancel comment" : "Leave a comment"}
      </button>
      <button
        className="board-view-page__action"
        onClick={onToggleComments}
        type="button"
      >
        Comments{commentCount > 0 ? ` (${commentCount})` : ""}
      </button>
      <Link
        className="board-view-page__action"
        to={`/board/${board.slug ?? ""}/present`}
      >
        Present
      </Link>
      <ShareButtons
        description={board.title}
        imageUrl={board.coverUrl ?? undefined}
        title={`${board.title} — ${settings.name}`}
        url={`/board/${board.slug ?? ""}`}
      />
    </div>
  );
}

/**
 * A published board, read-only, at its own address.
 *
 * No authentication: publishing is what makes a board readable, and the API
 * returns 404 for one that is not published rather than 403 — a private board
 * should not be discoverable by the difference between the two.
 *
 * Visitors can leave a comment on any item: clicking an item in comment mode
 * opens a small form, and the run of comments lives in the sidebar. Comments
 * are public; marking one resolved is not.
 */
export function BoardViewPage() {
  const { frameSlug, slug } = useParams<{ frameSlug?: string; slug: string }>();
  const navigate = useNavigate();
  const { settings } = useSiteSettings();
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState<BoardComment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [commentMode, setCommentMode] = useState(false);
  const [commentTarget, setCommentTarget] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /*
   * Which picture in the open frame is being looked at.
   *
   * Not in the URL. The frame is the thing worth sharing — "look at the deck
   * mockups" — and putting the index there too would mean every arrow press
   * pushed a history entry, so leaving the viewer took eleven Backs.
   */
  const [shownIndex, setShownIndex] = useState(0);
  const [localFrameRender, setLocalFrameRender] = useState<{
    frameId: string;
    key: string;
    url: string;
  } | null>(null);

  useEffect(() => {
    if (!slug) {
      return;
    }
    let cancelled = false;
    void (async () => {
      let loaded: Board;
      try {
        loaded = await boardsApi.get(slug);
      } catch {
        if (!cancelled) {
          setError("This board is not available.");
        }
        return;
      }
      if (cancelled) {
        return;
      }
      setBoard(loaded);

      /*
       * The comments are fetched on their own, and are allowed to fail.
       *
       * They used to share the board's try, so a comments endpoint that answered
       * 502 threw out a board that had already loaded perfectly and put "this
       * board is not available" in front of a visitor looking at a live public
       * board. The two requests are not one operation: the board is the page,
       * and the comments are an annotation on it.
       *
       * Silent, because there is nothing a visitor can do about it and the
       * sidebar showing none is the truthful state — the alternative is an error
       * over a board they can otherwise read and share.
       */
      try {
        const list = await commentsApi.list(loaded.id);
        if (!cancelled) {
          setComments(list);
        }
      } catch {
        // Left empty; the board stands on its own.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const createComment = useCallback(
    async (name: string, body: string) => {
      if (!(board && commentTarget)) {
        return;
      }
      setSubmitting(true);
      try {
        const created = await commentsApi.create({
          authorName: name,
          boardId: board.id,
          body,
          itemId: commentTarget,
        });
        setComments((current) => [...current, created]);
        setCommentTarget(null);
        toast.success("Comment posted");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not post the comment"
        );
      } finally {
        setSubmitting(false);
      }
    },
    [board, commentTarget]
  );

  /*
   * Which frame the address names, and what is in it.
   *
   * Memoised on the items rather than recomputed per render: `containedBy` walks
   * every item against every nested frame, and this runs on a board that is also
   * panning and zooming under the pointer.
   */
  const items = board?.items ?? [];
  const frames = useMemo(
    () => items.filter((item) => item.kind === "frame"),
    [items]
  );
  const openFrame = useMemo(
    () =>
      frameSlug
        ? (frameForSlug(
            frames.map((frame) => ({ id: frame.id, name: frame.body })),
            frameSlug
          ) ?? null)
        : null,
    [frames, frameSlug]
  );
  const selectedFrame = openFrame
    ? (frames.find((frame) => frame.id === openFrame.id) ?? null)
    : null;
  const selectedFrameKey = selectedFrame
    ? frameKeyOf(selectedFrame, items)
    : null;
  // Drawn here at twice the frame's size, so it is sharp on any screen; the
  // stored render (the frame's own size) shows until it is ready.
  useEffect(() => {
    if (!(selectedFrame && isDesignFrame(selectedFrame, items))) {
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    void renderFrameAt(selectedFrame, items)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setLocalFrameRender({
          frameId: selectedFrame.id,
          key: selectedFrameKey ?? "",
          url: objectUrl,
        });
      })
      .catch(() => {
        // The existing picture list remains available if a layer cannot export.
      });
    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [items, selectedFrame, selectedFrameKey]);

  const framed = useMemo(() => {
    const frame = openFrame && frames.find((one) => one.id === openFrame.id);
    if (!frame) {
      return [];
    }
    if (isDesignFrame(frame, items)) {
      const url =
        (localFrameRender?.frameId === frame.id &&
        localFrameRender.key === frameKeyOf(frame, items)
          ? localFrameRender.url
          : null) ?? currentFrameRender(frame, items);
      if (url) {
        return [{ ...frame, imageUrl: url }];
      }
    }
    // Only what has a picture: a frame may also hold a note or a prompt node,
    // and paging onto one of those would look like the viewer breaking.
    return containedBy(frame, items).filter((item) =>
      Boolean(currentImageUrl(item))
    );
  }, [items, frames, localFrameRender, openFrame]);

  const openFrameSlug = useCallback(
    (frameId: string) => {
      const slugs = frameSlugs(
        frames.map((frame) => ({ id: frame.id, name: frame.body }))
      );
      const named = slugs.get(frameId);
      if (named && slug) {
        setShownIndex(0);
        navigate(`/board/${slug}/${named}`);
      }
    },
    [frames, navigate, slug]
  );

  // Back to the board. `navigate` rather than a history pop so closing works
  // the same whether the frame was opened here or arrived at by a shared link.
  const closeFrame = useCallback(() => {
    if (slug) {
      navigate(`/board/${slug}`);
    }
  }, [navigate, slug]);

  if (error) {
    return (
      <div className="page board-view-page__error">
        <p className="board-view-page__error-note">{error}</p>
      </div>
    );
  }

  const targetItem = commentTarget
    ? board?.items?.find((item) => item.id === commentTarget)
    : undefined;

  return (
    // `board-fixed` pins the canvas to the dark board palette. A published board
    // is front end: it belongs to the branded site, so a visitor sees it the way
    // it was shared whatever their machine prefers. The light/dark switch is for
    // the editor, which is a surface you work on rather than a page you are sent.
    <div className="board-fixed board-view-page">
      <header className="row board-view-page__bar row--between row--wrap">
        <div className="board-view-page__identity">
          <h1 className="board-view-page__title">{board?.title ?? "Board"}</h1>
          <p className="board-view-page__site">{settings.name}</p>
        </div>
        <div className="row">
          {board ? (
            <PublishedActions
              board={board}
              commentCount={comments.length}
              commentMode={commentMode}
              onToggleCommentMode={() => setCommentMode((mode) => !mode)}
              onToggleComments={() => setShowComments((open) => !open)}
            />
          ) : null}
        </div>
      </header>

      <div className="board-view-page__canvas">
        {/* Frames on a published board open as their own view; the provider is
            what tells them so. See FrameOpenContext. */}
        <FrameOpenProvider
          downloadFor={(frameId) => {
            const frame = items.find((i) => i.id === frameId);
            return frame && isDesignFrame(frame, items)
              ? () => void downloadFrame(frame, items)
              : null;
          }}
          linkFor={(frameId) =>
            frameLink(
              slug ? `${window.location.origin}/board/${slug}` : null,
              items,
              frameId
            )
          }
          onOpenFrame={openFrameSlug}
        >
          <BoardCanvas
            // A visitor runs no tools, so there is no result to write back.
            boardId={null}
            commentMode={commentMode}
            comments={comments}
            items={board?.items ?? []}
            keyOf={(item: BoardItem) => item.id}
            // Nothing here can change the board; the setter exists only because
            // the canvas is shared with the editor.
            onChange={() => undefined}
            onCommentItem={(itemId) => {
              setCommentTarget(itemId);
              setCommentMode(false);
            }}
            readOnly
            // No connection lines on the published page, for anyone: a visitor
            // sees the pictures, not the machinery that made them. The API
            // sends none to a stranger; this also hides them from the owner
            // and anyone signed in, so the page looks the same to everybody.
            wires={NO_WIRES}
          />
        </FrameOpenProvider>

        {openFrame ? (
          <FrameViewer
            index={Math.min(shownIndex, Math.max(framed.length - 1, 0))}
            items={framed}
            link={
              slug
                ? frameLink(
                    `${window.location.origin}/board/${slug}`,
                    items,
                    openFrame.id
                  )
                : null
            }
            name={openFrame.name?.trim() || "Frame"}
            onClose={closeFrame}
            onIndex={setShownIndex}
          />
        ) : null}

        {showComments && board ? (
          <CommentsPanel
            comments={comments}
            items={board.items ?? []}
            onClose={() => setShowComments(false)}
          />
        ) : null}

        {commentTarget && board ? (
          <CommentDialog
            itemLabel={itemLabel(targetItem)}
            onCancel={() => setCommentTarget(null)}
            onCreate={(name, body) => void createComment(name, body)}
            submitting={submitting}
          />
        ) : null}
      </div>
    </div>
  );
}
