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
import { CardContent, CardFooter, CardHeader } from "../ui/card";
import { Input } from "../ui/input";
import { AdminCard } from "./AdminFrame";
import {
  AdminEmpty,
  AdminList,
  AdminListPage,
  AdminListRow,
  AdminMono,
  AdminRowAction,
  AdminRowLink,
  AdminStatus,
} from "./AdminList";
import { useConfirm } from "./ConfirmProvider";
import { ReviewEditor } from "./ReviewEditor";

const labelClass = "text-sm uppercase tracking-widest text-white/90";

/** Mirrors the API's slug rules so the suggested address is accepted as is. */
const slugify = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

const listStatus = (review: ReviewSummary): string =>
  review.sent ? "sent" : review.status;

/** The status tone, by how far along it is: draft, published, sent. */
const statusTone = (review: ReviewSummary): "draft" | "pending" | "ready" => {
  if (review.sent) {
    return "pending";
  }
  return review.status === "published" ? "ready" : "draft";
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
    <AdminListPage
      action={
        <Button
          onClick={() => setIsCreating((v) => !v)}
          type="button"
          variant="ghost"
        >
          {isCreating ? <X size={14} /> : <Plus size={14} />}
          {isCreating ? "Cancel" : "New review"}
        </Button>
      }
      icon={SearchVisualIcon}
      title="Reviews"
    >
      {isCreating ? (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => void handleCreate(e)}
        >
          <AdminCard>
            <CardHeader>New review</CardHeader>
            <CardContent layout="grid">
              <div className="space-y-2">
                <label className={labelClass} htmlFor="new-review-title">
                  Title
                </label>
                <Input
                  autoFocus
                  id="new-review-title"
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Pretext launch design"
                  size="lg"
                  value={newTitle}
                />
                {newTitle.trim() ? (
                  <p className="font-mono text-sm text-white/80">
                    /review/{slugify(newTitle)}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <label className={labelClass} htmlFor="new-review-client">
                  Client (as it should read on the page)
                </label>
                <Input
                  id="new-review-client"
                  onChange={(e) => setNewClient(e.target.value)}
                  placeholder="Vin at Viaskai"
                  size="lg"
                  value={newClient}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button
                disabled={isBusy || !newTitle.trim()}
                type="submit"
                variant="outline"
              >
                Create draft
              </Button>
            </CardFooter>
          </AdminCard>
        </form>
      ) : null}

      {reviews.length === 0 ? (
        <AdminEmpty>
          No reviews yet. Make one, capture or upload the screens, pin the
          notes, and send the link.
        </AdminEmpty>
      ) : (
        <AdminList>
          {reviews.map((review) => (
            <AdminListRow
              actions={
                <>
                  <AdminRowLink href={`/review/${review.slug}`}>
                    View
                  </AdminRowLink>
                  <AdminRowAction
                    icon={Edit02Icon}
                    label={`Edit ${review.title}`}
                    onClick={() => openReview(review.slug)}
                  />
                  <AdminRowAction
                    danger
                    icon={Delete02Icon}
                    label={`Delete ${review.title}`}
                    onClick={() => void handleDelete(review)}
                  />
                </>
              }
              key={review.id}
              meta={
                <>
                  {review.clientName ? <span>{review.clientName}</span> : null}
                  <AdminMono>/review/{review.slug}</AdminMono>
                  <span>
                    {review.counts.screens}{" "}
                    {review.counts.screens === 1 ? "screen" : "screens"} ·{" "}
                    {review.counts.notes}{" "}
                    {review.counts.notes === 1 ? "note" : "notes"}
                  </span>
                </>
              }
              onOpen={() => openReview(review.slug)}
              status={
                <AdminStatus tone={statusTone(review)}>
                  {listStatus(review)}
                </AdminStatus>
              }
              title={review.title}
            />
          ))}
        </AdminList>
      )}
    </AdminListPage>
  );
}
