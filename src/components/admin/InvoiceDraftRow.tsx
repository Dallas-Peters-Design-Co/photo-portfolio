import { Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  formatMoney,
  type Invoice,
  type InvoiceInput,
  invoicesApi,
} from "../../services/activityService";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { proposalInputClass, proposalLabelClass } from "./proposalStyles";

/**
 * A draft invoice, edited in place: amount, what it's for, who it goes to,
 * and how long they have. Each field saves when it loses focus, so Send
 * always sends what is on screen.
 */

const centsFrom = (dollars: string): number =>
  Math.round(Number(dollars.replaceAll(/[$,\s]/g, "")) * 100);

export function InvoiceDraftRow({
  invoice,
  busy,
  stripe,
  onChange,
  onSend,
  onRemove,
}: {
  busy: boolean;
  invoice: Invoice;
  onChange: (next: Invoice) => void;
  onRemove: () => void;
  onSend: () => void;
  stripe: boolean;
}) {
  const [amount, setAmount] = useState((invoice.amountCents / 100).toFixed(2));
  const [description, setDescription] = useState(invoice.description);
  const [email, setEmail] = useState(invoice.customerEmail);
  const [dueDays, setDueDays] = useState(String(invoice.dueDays));
  const [saving, setSaving] = useState(false);
  const { id } = invoice;

  const save = async (patch: InvoiceInput) => {
    setSaving(true);
    try {
      onChange(await invoicesApi.update(id, patch));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const cents = centsFrom(amount);
  const amountOk = Number.isFinite(cents) && cents > 0;
  const canSend = stripe && amountOk && Boolean(email.trim()) && !saving;
  let reason = "";
  if (!stripe) {
    reason = "Connect Stripe first";
  } else if (!email.trim()) {
    reason = "Add the client's email";
  }

  return (
    <li className="space-y-3 rounded-md border border-amber-300/20 p-3">
      <div className="grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
        <div className="space-y-1.5">
          <Label className={proposalLabelClass} htmlFor={`inv-amount-${id}`}>
            Amount (USD)
          </Label>
          <Input
            className={`${proposalInputClass} tabular-nums`}
            id={`inv-amount-${id}`}
            inputMode="decimal"
            onBlur={() => {
              if (amountOk && cents !== invoice.amountCents) {
                void save({ amountCents: cents });
              }
            }}
            onChange={(e) => setAmount(e.target.value)}
            value={amount}
          />
        </div>
        <div className="space-y-1.5">
          <Label className={proposalLabelClass} htmlFor={`inv-desc-${id}`}>
            What it's for
          </Label>
          <Input
            className={proposalInputClass}
            id={`inv-desc-${id}`}
            onBlur={() => {
              if (description.trim() && description !== invoice.description) {
                void save({ description });
              }
            }}
            onChange={(e) => setDescription(e.target.value)}
            value={description}
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
        <div className="space-y-1.5">
          <Label className={proposalLabelClass} htmlFor={`inv-email-${id}`}>
            Send to
          </Label>
          <Input
            className={proposalInputClass}
            id={`inv-email-${id}`}
            onBlur={() => {
              if (email !== invoice.customerEmail) {
                void save({ customerEmail: email });
              }
            }}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            value={email}
          />
        </div>
        <div className="space-y-1.5">
          <Label className={proposalLabelClass} htmlFor={`inv-due-${id}`}>
            Due in (days)
          </Label>
          <Input
            className={`${proposalInputClass} tabular-nums`}
            id={`inv-due-${id}`}
            inputMode="numeric"
            onBlur={() => {
              const days = Number.parseInt(dueDays, 10);
              if (Number.isInteger(days) && days !== invoice.dueDays) {
                void save({ dueDays: days });
              }
            }}
            onChange={(e) => setDueDays(e.target.value)}
            value={dueDays}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={busy || !canSend}
          onClick={onSend}
          title={reason || undefined}
          type="button"
          variant="outline"
        >
          <Send size={14} />
          {busy
            ? "Sending…"
            : `Send ${amountOk ? formatMoney(cents) : ""} invoice`}
        </Button>
        <Button
          disabled={busy}
          onClick={onRemove}
          type="button"
          variant="ghost"
        >
          <Trash2 size={14} /> Delete draft
        </Button>
        {reason ? (
          <span className="text-[10px] text-amber-400/70 uppercase tracking-[0.16em]">
            {reason}
          </span>
        ) : null}
        {saving ? (
          <span className="text-[11px] text-white/45">Saving…</span>
        ) : null}
      </div>
    </li>
  );
}
