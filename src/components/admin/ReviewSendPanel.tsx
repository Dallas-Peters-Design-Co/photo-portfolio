import { Copy, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { type ReviewRecord, reviewsApi } from "../../services/reviewService";
import { siteConfig } from "../../site";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { proposalLabelClass, proposalTextareaClass } from "./proposalStyles";

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
  const [isSending, setIsSending] = useState(false);
  const url = `https://${siteConfig.domain}/review/${review.slug}`;
  const email = review.clientEmail?.trim() ?? "";
  const canSend = review.status === "published" && Boolean(email);
  let reason = "";
  if (review.status !== "published") {
    reason = "Publish first";
  } else if (!email) {
    reason = "Add the client email and save";
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
      const next = await reviewsApi.send(review.slug, { note });
      onChange(next);
      setNote("");
      toast.success(`Sent to ${next.sent?.to ?? email}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className="space-y-4 rounded-md border border-white/10 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-[11px] text-white/70 uppercase tracking-[0.2em]">
          Send to client
        </h3>
        <code className="truncate font-mono text-[11px] text-white/60">
          {url}
        </code>
        <Button onClick={() => void copy()} type="button" variant="ghost">
          <Copy size={14} /> Copy link
        </Button>
      </div>
      <div className="space-y-2">
        <Label className={proposalLabelClass} htmlFor="review-note">
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
          <span className="text-[10px] text-amber-400/70 uppercase tracking-[0.16em]">
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
