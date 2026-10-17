import { HugeiconsIcon } from "@hugeicons/react";
import Delete02Icon from "@hugeicons-pro/core-stroke-standard/Delete02Icon";
import Edit02Icon from "@hugeicons-pro/core-stroke-standard/Edit02Icon";
import SearchVisualIcon from "@hugeicons-pro/core-stroke-standard/SearchVisualIcon";
import { Plus, X } from "lucide-react";
import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  type ReviewRecord,
  type ReviewSummary,
  reviewsApi,
} from "../../services/reviewService";
import { Button } from "../ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "../ui/card";
import { Input } from "../ui/input";
import { useConfirm } from "./ConfirmProvider";
import { ReviewEditor } from "./ReviewEditor";

const labelClass = "text-[10px] uppercase tracking-widest text-white/90";
const inputClass =
  "min-h-11 text-base bg-black/40 border-white/10 focus:border-white/40 transition-colors";

/** Mirrors the API's slug rules so the suggested address is accepted as is. */
const slugify = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

const listStatus = (review: ReviewSummary): string =>
  review.sent ? "sent" : review.status;

/** The status, coloured by how far along it is: draft, published, sent, accepted. */
const statusClass = (review: ReviewSummary): string => {
  const base = "shrink-0 text-[11px] uppercase tracking-[0.16em]";
  if (review.sent) {
    return `${base} text-sky-400/90`;
  }
  return review.status === "published"
    ? `${base} text-emerald-400/70`
    : `${base} text-amber-400/70`;
};

/**
 * The reviews list, and the editor for whichever one the address names.
 *
 * Same shape as PagesPanel: the URL decides what is open, so a review being
 * edited is a link you can come back to, and Back returns to the list.
 */
export function ReviewsPanel() {
  const { confirm } = useConfirm();
  const navigate = useNavigate();
  const { slug: editingSlug } = useParams<{ slug: string }>();
  const [reviews, setReviews] = useState<ReviewSummary[]>([]);
  const [editing, setEditing] = useState<ReviewRecord | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newClient, setNewClient] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      setReviews(await reviewsApi.list());
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not load reviews"
      );
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const openReview = (slug: string): void => {
    navigate(`/admin/reviews/${encodeURIComponent(slug)}`);
  };

  const closeEditor = (): void => {
    navigate("/admin/reviews");
  };

  const handleCreate = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) {
      return;
    }
    setIsBusy(true);
    try {
      const created = await reviewsApi.create({
        clientName: newClient.trim(),
        slug: slugify(title),
        status: "draft",
        title,
      });
      toast.success(`"${created.title}" created as a draft`);
      setNewTitle("");
      setNewClient("");
      setIsCreating(false);
      await reload();
      openReview(created.slug);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not create review"
      );
    } finally {
      setIsBusy(false);
    }
  };

  useEffect(() => {
    if (!editingSlug) {
      setEditing(null);
      return;
    }
    let cancelled = false;
    setEditing(null);
    void (async () => {
      try {
        const record = await reviewsApi.get(editingSlug);
        if (!cancelled) {
          setEditing(record);
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(
            err instanceof Error ? err.message : "Could not open review"
          );
          navigate("/admin/reviews", { replace: true });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editingSlug, navigate]);

  const handleDelete = async (review: ReviewSummary): Promise<void> => {
    const ok = await confirm({
      confirmLabel: "Delete",
      description:
        "The review is removed and its link stops working. This cannot be undone.",
      destructive: true,
      title: `Delete "${review.title}"?`,
    });
    if (!ok) {
      return;
    }
    try {
      await reviewsApi.remove(review.slug);
      toast.success("Review deleted");
      if (editingSlug === review.slug) {
        closeEditor();
      }
      await reload();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not delete review"
      );
    }
  };

  if (editing) {
    return (
      <ReviewEditor
        onClose={closeEditor}
        onSaved={async (saved) => {
          await reload();
          // A renamed address moves the editor with it, so a reload after
          // saving does not land on a 404.
          if (saved.slug !== editingSlug) {
            navigate(`/admin/reviews/${encodeURIComponent(saved.slug)}`, {
              replace: true,
            });
          }
        }}
        review={editing}
      />
    );
  }

  return (
    <div className="grid w-full max-w-7xl grid-cols-1 gap-4 border-white/10">
      <div className="flex flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 font-light text-sm text-white/90 uppercase tracking-[0.2em]">
          <HugeiconsIcon icon={SearchVisualIcon} size={16} />
          Reviews
        </div>
        <Button
          onClick={() => setIsCreating((v) => !v)}
          type="button"
          variant="ghost"
        >
          {isCreating ? <X size={14} /> : <Plus size={14} />}
          {isCreating ? "Cancel" : "New review"}
        </Button>
      </div>

      {isCreating ? (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => void handleCreate(e)}
        >
          <Card className="w-full border-white bg-white/2">
            <CardHeader className={labelClass}>New review</CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className={labelClass} htmlFor="new-review-title">
                  Title
                </label>
                <Input
                  autoFocus
                  className={inputClass}
                  id="new-review-title"
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Pretext launch design"
                  value={newTitle}
                />
                {newTitle.trim() ? (
                  <p className="font-mono text-[10px] text-white/80">
                    /review/{slugify(newTitle)}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <label className={labelClass} htmlFor="new-review-client">
                  Client (as it should read on the page)
                </label>
                <Input
                  className={inputClass}
                  id="new-review-client"
                  onChange={(e) => setNewClient(e.target.value)}
                  placeholder="Vin at Viaskai"
                  value={newClient}
                />
              </div>
            </CardContent>
            <CardFooter className="flex items-center justify-end gap-3">
              <Button
                disabled={isBusy || !newTitle.trim()}
                type="submit"
                variant="outline"
              >
                Create draft
              </Button>
            </CardFooter>
          </Card>
        </form>
      ) : null}

      {reviews.length === 0 ? (
        <p className="text-[11px] text-white/80 uppercase tracking-[0.15em]">
          No reviews yet. Make one, capture or upload the screens, pin the
          notes, and send the link.
        </p>
      ) : (
        <ul className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-white/2">
          {reviews.map((review) => (
            <li
              className="flex flex-wrap items-center gap-x-6 gap-y-3 px-6 py-5"
              key={review.id}
            >
              <button
                className="min-w-0 flex-1 text-left"
                onClick={() => openReview(review.slug)}
                type="button"
              >
                <span className="block truncate text-lg text-white leading-snug">
                  {review.title}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-white/60">
                  {review.clientName ? <span>{review.clientName}</span> : null}
                  <span className="font-mono text-[13px]">
                    /review/{review.slug}
                  </span>
                  <span>
                    {review.counts.screens}{" "}
                    {review.counts.screens === 1 ? "screen" : "screens"} ·{" "}
                    {review.counts.notes}{" "}
                    {review.counts.notes === 1 ? "note" : "notes"}
                  </span>
                </span>
              </button>
              <span className={statusClass(review)}>{listStatus(review)}</span>
              <div className="flex items-center gap-1">
                <a
                  className="rounded-md px-3 py-2 text-[11px] text-white/90 uppercase tracking-[0.16em] transition-colors hover:bg-white/5 hover:text-white"
                  href={`/review/${review.slug}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  View
                </a>
                <button
                  aria-label={`Edit ${review.title}`}
                  className="rounded-md p-2 text-white/80 transition-colors hover:bg-white/5 hover:text-white"
                  onClick={() => openReview(review.slug)}
                  type="button"
                >
                  <HugeiconsIcon icon={Edit02Icon} size={18} />
                </button>
                <button
                  aria-label={`Delete ${review.title}`}
                  className="rounded-md p-2 text-white/80 transition-colors hover:bg-white/5 hover:text-red-400"
                  onClick={() => void handleDelete(review)}
                  type="button"
                >
                  <HugeiconsIcon icon={Delete02Icon} size={18} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
