import { Copy, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { type ReviewRecord, reviewsApi } from "../../services/reviewService";
import { siteConfig } from "../../site";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { proposalTextareaClass } from "./proposalStyles";

/** Getting the review to the client: copy the link, or email it with a note. */
export function ReviewSendPanel({
  review,
  busy,
  onChange,
}: {
  review: ReviewRecord;
  busy: boolean;
  onChange: (next: ReviewRecord) => void;
}) {
  const [note, setNote] = useState("");
  const [password, setPassword] = useState("");
  const [isSending, setIsSending] = useState(false);
  const url = `https://${siteConfig.domain}/review/${review.slug}`;
  const email = review.clientEmail?.trim() ?? "";
  const canSend =
    review.status === "published" &&
    Boolean(email) &&
    (!review.hasPassword || Boolean(password));
  let reason = "";
  if (review.status !== "published") {
    reason = "Publish first";
  } else if (!email) {
    reason = "Add the client email and save";
  } else if (review.hasPassword && !password) {
    reason = "Enter the review password so the client can open the review";
  }
  let label = `Send to ${email || "client"}`;
  if (isSending) {
    label = "Sending…";
  } else if (review.sent) {
    label = `Send again to ${email}`;
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error(url);
    }
  };

  const send = async () => {
    setIsSending(true);
    try {
      const next = await reviewsApi.send(review.slug, { note, password });
      onChange(next);
      setNote("");
      setPassword("");
      toast.success(`Sent to ${next.sent?.to ?? email}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <code className="truncate font-mono text-sm text-white/60">{url}</code>
        <Button onClick={() => void copy()} type="button" variant="ghost">
          <Copy size={14} /> Copy link
        </Button>
      </div>
      <div className="space-y-2">
        <Label htmlFor="review-note">
          Note (optional, goes above the link)
        </Label>
        <textarea
          className={proposalTextareaClass}
          id="review-note"
          onChange={(e) => setNote(e.target.value)}
          placeholder="Here's the review we talked about…"
          value={note}
        />
      </div>
      {review.hasPassword ? (
        <div className="space-y-2">
          <Label htmlFor="review-send-password">
            Review password (included in email)
          </Label>
          <Input
            autoComplete="off"
            id="review-send-password"
            maxLength={200}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter the current review password"
            size="lg"
            type="password"
            value={password}
          />
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-3 text-sm text-white/70">
        <Button
          disabled={busy || isSending || !canSend}
          onClick={() => void send()}
          title={reason || undefined}
          type="button"
          variant="outline"
        >
          <Send size={14} />
          {label}
        </Button>
        {canSend ? null : (
          <span className="text-amber-400/70 text-sm uppercase tracking-micro-wide">
            {reason}
          </span>
        )}
        {review.sent ? (
          <span>
            Sent to {review.sent.to} on{" "}
            {new Date(review.sent.at).toLocaleString()}
          </span>
        ) : null}
      </div>
    </section>
  );
}
