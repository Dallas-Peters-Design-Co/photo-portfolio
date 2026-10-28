import { ExternalLink, Plus, Send, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  formatMoney,
  type Invoice,
  invoicesApi,
  priceToCents,
} from "../../services/activityService";
import type { ProposalRecord } from "../../services/proposalService";
import { Button } from "../ui/button";
import { useConfirm } from "./ConfirmProvider";
import { InvoiceDraftRow } from "./InvoiceDraftRow";

/**
 * Billing for this proposal, through Stripe.
 *
 * Drafts are local and editable: the first is made when the client signs,
 * from the chosen option's payment terms, and more can be added (the next
 * one is pre-filled with what is left to bill). Send creates the invoice in
 * Stripe and Stripe emails it to the client with a pay link; from then its
 * status follows Stripe. A sent invoice is voided rather than edited.
 */

const STATUS: Record<Invoice["status"], { cls: string; label: string }> = {
  draft: { cls: "text-amber-300/80", label: "Draft" },
  open: { cls: "text-sky-300/90", label: "Sent, unpaid" },
  paid: { cls: "text-emerald-300/90", label: "Paid" },
  uncollectible: { cls: "text-red-300/80", label: "Uncollectible" },
  void: { cls: "text-white/40", label: "Void" },
};

export function ProposalInvoices({
  proposal,
  onActivity,
}: {
  proposal: ProposalRecord;
  /** Called after anything that adds to the timeline. */
  onActivity: () => void;
}) {
  const { confirm } = useConfirm();
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [stripe, setStripe] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await invoicesApi.list(proposal.slug);
      setInvoices(next.invoices);
      setStripe(next.stripe);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load invoices");
      setInvoices([]);
    }
  }, [proposal.slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const replace = (next: Invoice) =>
    setInvoices(
      (list) => list?.map((i) => (i.id === next.id ? next : i)) ?? [next]
    );

  const live = (invoices ?? []).filter(
    (i) => i.status !== "void" && i.status !== "uncollectible"
  );
  // Billed is what has gone to the client; drafts still count towards what
  // is left, so a second draft is not pre-filled with money already drafted.
  const billed = live
    .filter((i) => i.status !== "draft")
    .reduce((sum, i) => sum + i.amountCents, 0);
  const planned = live.reduce((sum, i) => sum + i.amountCents, 0);

  // What is left to bill on the signed option, as the new draft's amount.
  const chosen = proposal.doc.packages.find(
    (p) => p.id === proposal.acceptance?.option
  );
  const total = chosen ? priceToCents(chosen.price) : null;
  const remaining = total ? total - planned : 0;

  const addDraft = async () => {
    setBusy("new");
    try {
      const created = await invoicesApi.create(proposal.slug, {
        amountCents: remaining > 0 ? remaining : 100,
        description: chosen
          ? `${proposal.title}: ${chosen.name}, balance`
          : proposal.title,
      });
      setInvoices((list) => [...(list ?? []), created]);
      onActivity();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not draft");
    } finally {
      setBusy(null);
    }
  };

  const send = async (invoice: Invoice) => {
    const ok = await confirm({
      confirmLabel: "Send",
      description: `Stripe will email ${formatMoney(invoice.amountCents, invoice.currency)} to ${invoice.customerEmail} with a link to pay.`,
      title: "Send this invoice?",
    });
    if (!ok) {
      return;
    }
    setBusy(invoice.id);
    try {
      replace(await invoicesApi.send(invoice.id));
      toast.success("Invoice sent");
      onActivity();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (invoice: Invoice) => {
    setBusy(invoice.id);
    try {
      if (invoice.status === "draft") {
        await invoicesApi.remove(invoice.id);
        setInvoices((list) => list?.filter((i) => i.id !== invoice.id) ?? []);
      } else {
        const ok = await confirm({
          confirmLabel: "Void",
          description:
            "The client's pay link stops working. Draft a new one if the amount was wrong.",
          destructive: true,
          title: "Void this invoice?",
        });
        if (ok) {
          replace(await invoicesApi.void(invoice.id));
          onActivity();
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="space-y-4 rounded-md border border-white/10 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-sm text-white/70 uppercase">Invoices</h3>
        {billed > 0 ? (
          <span className="text-sm text-white/55 tabular-nums">
            {formatMoney(billed)} billed
          </span>
        ) : null}
        <Button
          className="ml-auto"
          disabled={busy !== null}
          onClick={() => void addDraft()}
          type="button"
          variant="ghost"
        >
          <Plus size={14} /> New invoice
        </Button>
      </div>

      {stripe ? null : (
        <p className="text-[12px] text-amber-300/80">
          Stripe isn't connected yet. Drafts work; sending needs
          STRIPE_SECRET_KEY in Vercel.
        </p>
      )}

      {invoices && invoices.length === 0 ? (
        <p className="text-sm text-white/55">
          None yet. When the client signs, the first invoice is drafted here
          from the option they chose.
        </p>
      ) : null}

      <ul className="space-y-3">
        {(invoices ?? []).map((invoice) =>
          invoice.status === "draft" ? (
            <InvoiceDraftRow
              busy={busy === invoice.id}
              invoice={invoice}
              key={invoice.id}
              onChange={replace}
              onRemove={() => void remove(invoice)}
              onSend={() => void send(invoice)}
              stripe={stripe}
            />
          ) : (
            <li
              className="flex flex-wrap items-center gap-3 rounded-md bg-white/3 p-3 text-sm"
              key={invoice.id}
            >
              <span className="min-w-0 flex-1 text-white/85">
                {invoice.description}
                {invoice.number ? (
                  <span className="ml-2 text-white/45">{invoice.number}</span>
                ) : null}
              </span>
              <span className="text-white/90 tabular-nums">
                {formatMoney(invoice.amountCents, invoice.currency)}
              </span>
              <span
                className={`text-sm uppercase tracking-[0.16em] ${STATUS[invoice.status].cls}`}
              >
                {STATUS[invoice.status].label}
              </span>
              {invoice.hostedUrl ? (
                <a
                  className="inline-flex items-center gap-1 text-[12px] text-white/70 hover:text-white"
                  href={invoice.hostedUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  <ExternalLink size={12} /> View
                </a>
              ) : null}
              {invoice.status === "open" ? (
                <Button
                  disabled={busy === invoice.id}
                  onClick={() => void remove(invoice)}
                  type="button"
                  variant="ghost"
                >
                  <Trash2 size={14} /> Void
                </Button>
              ) : null}
            </li>
          )
        )}
      </ul>
      {invoices?.some((i) => i.status === "draft") ? (
        <p className="flex items-center gap-1.5 text-sm text-white/45">
          <Send size={11} /> Stripe emails the client a link to pay by card or
          bank transfer.
        </p>
      ) : null}
    </section>
  );
}
