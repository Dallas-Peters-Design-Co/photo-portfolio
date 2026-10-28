import { Copy, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  type ProposalRecord,
  proposalsApi,
} from "../../services/proposalService";
import { siteConfig } from "../../site";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { proposalLabelClass, proposalTextareaClass } from "./proposalStyles";

/**
 * Getting the proposal to the client, and what came back.
 *
 * The link is the deliverable: copy it, or have the site email it with a
 * note. Sending needs a published proposal (the link must work) and the
 * client email on the saved record, which is why the button explains itself
 * when it is disabled rather than failing after a click. Underneath, the
 * acceptance once there is one, with the reset.
 */
export function ProposalSendPanel({
  proposal,
  busy,
  onChange,
  onReset,
}: {
  proposal: ProposalRecord;
  busy: boolean;
  onChange: (next: ProposalRecord) => void;
  onReset: () => void;
}) {
  const [note, setNote] = useState("");
  const [isSending, setIsSending] = useState(false);
  const url = `https://${siteConfig.domain}/proposal/${proposal.slug}`;
  const email = proposal.clientEmail?.trim() ?? "";
  const canSend = proposal.status === "published" && Boolean(email);
  let reason = "";
  if (proposal.status !== "published") {
    reason = "Publish first";
  } else if (!email) {
    reason = "Add the client email and save";
  }
  let label = `Send to ${email || "client"}`;
  if (isSending) {
    label = "Sending…";
  } else if (proposal.sent) {
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
      const next = await proposalsApi.send(proposal.slug, { note });
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
        <h3 className="text-sm text-white/70 uppercase">Send to client</h3>
        <code className="truncate font-mono text-sm text-white/60">{url}</code>
        <Button onClick={() => void copy()} type="button" variant="ghost">
          <Copy size={14} /> Copy link
        </Button>
      </div>
      <div className="space-y-2">
        <Label className={proposalLabelClass} htmlFor="proposal-note">
          Note (optional, goes above the link)
        </Label>
        <textarea
          className={proposalTextareaClass}
          id="proposal-note"
          onChange={(e) => setNote(e.target.value)}
          placeholder="Here's the proposal we talked about…"
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
          <span className="text-amber-400/70 text-sm uppercase tracking-[0.16em]">
            {reason}
          </span>
        )}
        {proposal.sent ? (
          <span>
            Sent to {proposal.sent.to} on{" "}
            {new Date(proposal.sent.at).toLocaleString()}
          </span>
        ) : null}
      </div>
      {proposal.acceptance ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-emerald-400/30 p-3 text-sm text-white/85">
          <span>
            Accepted by {proposal.acceptance.name}
            {proposal.acceptance.title ? `, ${proposal.acceptance.title}` : ""}{" "}
            on {new Date(proposal.acceptance.at).toLocaleDateString()}
          </span>
          <Button
            disabled={busy}
            onClick={onReset}
            type="button"
            variant="ghost"
          >
            Reset acceptance
          </Button>
        </div>
      ) : null}
    </section>
  );
}
