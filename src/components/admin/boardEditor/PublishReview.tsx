import DocumentValidationIcon from "@hugeicons-pro/core-stroke-standard/DocumentValidationIcon";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import {
  countCaptured,
  publishBoardReview,
  reviewSlugFor,
} from "../../../boards/review/publishReview";
import { type ReviewRecord, reviewsApi } from "../../../services/reviewService";
import type { Board, BoardItem } from "../../../types";
import { Button } from "../../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { HeaderIcon } from "./HeaderIcon";

/**
 * "Publish review" in the board header, once a Browser node has taken a
 * screenshot: every captured browser node, with its markup and notes,
 * becomes a screen of this board's review (boards/review/publishReview.ts).
 * Publishing again updates the same review, keeping what was written in the
 * review editor and the client's comments.
 */
export function PublishReview({
  board,
  items,
}: {
  board: Board | null;
  items: BoardItem[];
}) {
  const [open, setOpen] = useState(false);
  const [existing, setExisting] = useState<ReviewRecord | null>(null);
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [password, setPassword] = useState("");
  const [removePassword, setRemovePassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [published, setPublished] = useState<ReviewRecord | null>(null);
  const count = countCaptured(items);

  if (!board || count === 0) {
    return null;
  }
  const slug = reviewSlugFor(board);
  const link = `${window.location.origin}/review/${slug}`;

  const start = async () => {
    setOpen(true);
    setPublished(null);
    setPassword("");
    setRemovePassword(false);
    const found = await reviewsApi.get(slug).catch(() => null);
    setExisting(found);
    setTitle(found?.title ?? `${board.title} review`);
    setClientName(found?.clientName ?? "");
  };

  const passwordToSend = (): string | undefined => {
    if (removePassword) {
      return "";
    }
    return password || undefined;
  };

  const publish = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const review = await publishBoardReview({
        board,
        clientName,
        items,
        password: passwordToSend(),
        title,
      });
      setPublished(review);
      setExisting(review);
      setPassword("");
      toast.success("Review published");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't publish the review"
      );
    } finally {
      setBusy(false);
    }
  };

  const comments = existing?.feedback.filter((f) => !f.resolved).length ?? 0;

  return (
    <>
      <HeaderIcon
        badge={comments}
        icon={DocumentValidationIcon}
        label={existing ? "Update the review" : "Publish a review"}
        onClick={() => {
          start().catch(() => undefined);
        }}
      />
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {existing ? "Update the review" : "Publish a review"}
            </DialogTitle>
            <DialogDescription>
              {count} {count === 1 ? "screenshot" : "screenshots"} from this
              board, each with its markup and numbered notes.
              {existing
                ? " What you wrote in the review editor and the client's comments stay."
                : ""}
            </DialogDescription>
          </DialogHeader>
          {published ? (
            <div className="grid gap-3">
              <p>It's live at:</p>
              <Input readOnly value={link} />
              {published.hasPassword ? (
                <p className="text-muted-foreground">
                  Send the password separately from the link.
                </p>
              ) : null}
              <DialogFooter>
                <Button
                  onClick={() => window.open(`/review/${slug}`, "_blank")}
                  type="button"
                  variant="outline"
                >
                  Open
                </Button>
                <Button
                  onClick={() => {
                    navigator.clipboard
                      .writeText(link)
                      .then(() => toast.success("Link copied"))
                      .catch(() => undefined);
                  }}
                  type="button"
                >
                  Copy link
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form className="grid gap-3" onSubmit={publish}>
              <div className="grid gap-1.5">
                <Label htmlFor="review-title">Title</Label>
                <Input
                  id="review-title"
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  value={title}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="review-client">Client</Label>
                <Input
                  id="review-client"
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Who it's for"
                  value={clientName}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="review-password">Password</Label>
                <Input
                  autoComplete="new-password"
                  disabled={removePassword}
                  id="review-password"
                  minLength={4}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    existing?.hasPassword
                      ? "Leave blank to keep the current one"
                      : "Optional: clients enter it to read and comment"
                  }
                  type="password"
                  value={password}
                />
                {existing?.hasPassword ? (
                  <label className="flex items-center gap-2 text-muted-foreground">
                    <input
                      checked={removePassword}
                      onChange={(e) => setRemovePassword(e.target.checked)}
                      type="checkbox"
                    />
                    Take the password off
                  </label>
                ) : null}
              </div>
              <DialogFooter>
                <Button disabled={busy} type="submit">
                  {busy ? "Publishing…" : "Publish"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
