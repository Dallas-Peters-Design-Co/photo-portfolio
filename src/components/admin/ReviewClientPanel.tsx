import { Check, Lock, Trash2, Undo2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { ReviewFeedback } from "../../../config/reviewFeedback.js";
import { type ReviewRecord, reviewsApi } from "../../services/reviewService";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { proposalInputClass, proposalLabelClass } from "./proposalStyles";

/**
 * The client's side of a review, in the editor: the password that guards it,
 * and what the client has said on it.
 *
 * The password is saved on its own, straight away, rather than with the
 * review's autosave: it never comes back from the server, so there's
 * nothing for the editor's draft to hold. Comments can be marked resolved
 * (the client still sees them, faded) or removed.
 */
export function ReviewClientPanel({
  onChange,
  review,
}: {
  onChange: (next: Partial<ReviewRecord>) => void;
  review: ReviewRecord;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const savePassword = async (next: string) => {
    setBusy(true);
    try {
      const saved = await reviewsApi.update(review.slug, { password: next });
      onChange({ hasPassword: saved.hasPassword });
      setPassword("");
      toast.success(next ? "Password set" : "Password taken off");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't save the password"
      );
    } finally {
      setBusy(false);
    }
  };

  const resolve = async (item: ReviewFeedback) => {
    try {
      const saved = await reviewsApi.resolveComment(
        review.slug,
        item.id,
        !item.resolved
      );
      onChange({
        feedback: review.feedback.map((f) => (f.id === item.id ? saved : f)),
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't update that comment"
      );
    }
  };

  const remove = async (item: ReviewFeedback) => {
    try {
      await reviewsApi.removeComment(review.slug, item.id);
      onChange({ feedback: review.feedback.filter((f) => f.id !== item.id) });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't remove that comment"
      );
    }
  };

  const screenTitle = (id: string) =>
    id
      ? (review.doc.screens.find((s) => s.id === id)?.title ?? "A screen")
      : "The review";

  return (
    <section className="space-y-4 rounded-md border border-white/10 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-sm text-white/70 uppercase">Client access</h3>
        <span className="flex items-center gap-1 text-sm text-white/60">
          <Lock size={14} />
          {review.hasPassword ? "Password on" : "Anyone with the link"}
        </span>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1 space-y-2">
          <Label className={proposalLabelClass} htmlFor="review-password">
            {review.hasPassword ? "New password" : "Password"}
          </Label>
          <Input
            autoComplete="new-password"
            className={proposalInputClass}
            id="review-password"
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 4 characters"
            type="password"
            value={password}
          />
        </div>
        <Button
          disabled={busy || password.length < 4}
          onClick={() => void savePassword(password)}
          type="button"
          variant="outline"
        >
          {review.hasPassword ? "Change password" : "Set password"}
        </Button>
        {review.hasPassword ? (
          <Button
            disabled={busy}
            onClick={() => void savePassword("")}
            type="button"
            variant="ghost"
          >
            Take it off
          </Button>
        ) : null}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm text-white/70 uppercase">
          Client comments ({review.feedback.length})
        </h3>
        {review.feedback.length === 0 ? (
          <p className="text-sm text-white/50">
            Nothing yet. Clients comment and draw on the published review.
          </p>
        ) : (
          <ul className="space-y-2">
            {review.feedback.map((item) => (
              <li
                className={`flex items-start gap-3 rounded-md border border-white/10 p-3 ${item.resolved ? "opacity-50" : ""}`}
                key={item.id}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-white/60 text-xs uppercase tracking-wider">
                    {item.author} · {screenTitle(item.screenId)} ·{" "}
                    {new Date(item.createdAt).toLocaleString()}
                    {item.marks.length > 0
                      ? ` · ${item.marks.length} drawn`
                      : ""}
                  </p>
                  {item.body ? (
                    <p className="whitespace-pre-wrap text-sm">{item.body}</p>
                  ) : null}
                </div>
                <Button
                  aria-label={item.resolved ? "Reopen" : "Mark resolved"}
                  onClick={() => void resolve(item)}
                  size="icon-sm"
                  title={item.resolved ? "Reopen" : "Mark resolved"}
                  type="button"
                  variant="ghost"
                >
                  {item.resolved ? <Undo2 size={14} /> : <Check size={14} />}
                </Button>
                <Button
                  aria-label="Remove"
                  onClick={() => void remove(item)}
                  size="icon-sm"
                  title="Remove"
                  type="button"
                  variant="ghost"
                >
                  <Trash2 size={14} />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
