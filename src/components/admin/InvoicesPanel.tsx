import { ExternalLink, Plus, Receipt, Send, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  formatMoney,
  type Invoice,
  type InvoiceTemplate,
  invoicesApi,
} from "../../services/activityService";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { useConfirm } from "./ConfirmProvider";
import { InvoiceComposer } from "./InvoiceComposer";

/**
 * Every invoice in one place: the ones drafted from proposals and the ones
 * made here for any client, with the templates they can start from. Sending
 * creates the invoice in Stripe, which emails it with a pay link; from then
 * its status follows Stripe's webhooks.
 */

const STATUS: Record<Invoice["status"], { cls: string; label: string }> = {
  draft: { cls: "text-amber-300/80", label: "Draft" },
  open: { cls: "text-sky-300/90", label: "Sent, unpaid" },
  paid: { cls: "text-emerald-300/90", label: "Paid" },
  uncollectible: { cls: "text-red-300/80", label: "Uncollectible" },
  void: { cls: "text-white/40", label: "Void" },
};

export function InvoicesPanel() {
  const { confirm } = useConfirm();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
  const [stripe, setStripe] = useState(true);
  const [composing, setComposing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await invoicesApi.all();
      setInvoices(data.invoices);
      setTemplates(data.templates);
      setStripe(data.stripe);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load invoices");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const replace = (next: Invoice) =>
    setInvoices((list) => list.map((i) => (i.id === next.id ? next : i)));

  const act = async (invoice: Invoice, kind: "send" | "void" | "remove") => {
    const copy = {
      remove: {
        label: "Delete",
        text: "The draft is removed. Nothing was sent.",
        title: "Delete this draft?",
      },
      send: {
        label: "Send",
        text: `Stripe will email ${formatMoney(invoice.amountCents, invoice.currency)} to ${invoice.customerEmail} with a link to pay.`,
        title: "Send this invoice?",
      },
      void: {
        label: "Void",
        text: "The client's pay link stops working. This can't be undone.",
        title: "Void this invoice?",
      },
    }[kind];
    if (
      !(await confirm({
        confirmLabel: copy.label,
        description: copy.text,
        title: copy.title,
      }))
    ) {
      return;
    }
    setBusy(invoice.id);
    try {
      if (kind === "remove") {
        await invoicesApi.remove(invoice.id);
        setInvoices((list) => list.filter((i) => i.id !== invoice.id));
      } else {
        replace(
          await (kind === "send"
            ? invoicesApi.send(invoice.id)
            : invoicesApi.void(invoice.id))
        );
        toast.success(kind === "send" ? "Invoice sent" : "Invoice voided");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  };

  const removeTemplate = async (t: InvoiceTemplate) => {
    if (
      await confirm({
        confirmLabel: "Delete",
        description: "Invoices already made from it are unchanged.",
        title: `Delete "${t.name}"?`,
      })
    ) {
      await invoicesApi.deleteTemplate(t.id).catch(() => undefined);
      setTemplates((list) => list.filter((x) => x.id !== t.id));
    }
  };

  const outstanding = invoices
    .filter((i) => i.status === "open")
    .reduce((s, i) => s + i.amountCents, 0);

  return (
    <Card className="w-full max-w-6xl border-white/10 bg-white/2">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="flex items-center gap-2 font-light text-sm text-white/90 uppercase tracking-[0.2em]">
          <Receipt size={16} /> Invoices
        </CardTitle>
        <div className="flex items-center gap-4">
          {outstanding > 0 ? (
            <span className="text-[11px] text-sky-300/90 uppercase tracking-[0.16em]">
              {formatMoney(outstanding)} outstanding
            </span>
          ) : null}
          {composing ? null : (
            <Button
              onClick={() => setComposing(true)}
              type="button"
              variant="outline"
            >
              <Plus size={14} /> New invoice
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {stripe ? null : (
          <p className="text-amber-300/80 text-sm">
            Stripe isn't connected (STRIPE_SECRET_KEY), so drafts can be made
            but not sent.
          </p>
        )}

        {composing ? (
          <InvoiceComposer
            onClose={() => setComposing(false)}
            onCreated={(inv) => setInvoices((list) => [inv, ...list])}
            onTemplatesChange={setTemplates}
            templates={templates}
          />
        ) : null}

        {invoices.length === 0 ? (
          <p className="text-sm text-white/55">No invoices yet.</p>
        ) : (
          <ul className="divide-y divide-white/10">
            {invoices.map((inv) => (
              <li
                className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3"
                key={inv.id}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-white/90">
                    {inv.number ? `${inv.number} · ` : ""}
                    {inv.customerName || inv.customerEmail || "No client yet"}
                  </p>
                  <p className="truncate text-white/50 text-xs">
                    {inv.lines.map((l) => l.description).join(" · ")}
                  </p>
                </div>
                <span className="text-sm text-white/90 tabular-nums">
                  {formatMoney(inv.amountCents, inv.currency)}
                </span>
                <span
                  className={`w-36 text-[11px] uppercase tracking-[0.16em] ${STATUS[inv.status].cls}`}
                >
                  {STATUS[inv.status].label}
                </span>
                <div className="flex items-center gap-1">
                  {inv.status === "draft" ? (
                    <>
                      <Button
                        disabled={
                          !stripe || busy === inv.id || !inv.customerEmail
                        }
                        onClick={() => void act(inv, "send")}
                        type="button"
                        variant="ghost"
                      >
                        <Send size={14} /> Send
                      </Button>
                      <Button
                        aria-label="Delete draft"
                        disabled={busy === inv.id}
                        onClick={() => void act(inv, "remove")}
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </>
                  ) : null}
                  {inv.status === "open" ? (
                    <Button
                      aria-label="Void"
                      disabled={busy === inv.id}
                      onClick={() => void act(inv, "void")}
                      type="button"
                      variant="ghost"
                    >
                      <X size={14} />
                    </Button>
                  ) : null}
                  {inv.hostedUrl ? (
                    <a
                      aria-label="Open the client's invoice"
                      className="p-2 text-white/70 hover:text-white"
                      href={inv.hostedUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <ExternalLink size={14} />
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        <section className="space-y-2">
          <h3 className="text-[11px] text-white/70 uppercase tracking-[0.2em]">
            Templates
          </h3>
          {templates.length === 0 ? (
            <p className="text-sm text-white/55">
              Save one from a new invoice: a deposit, a monthly retainer, an
              hourly block.
            </p>
          ) : (
            <ul className="space-y-1">
              {templates.map((t) => (
                <li className="flex items-center gap-3 text-sm" key={t.id}>
                  <span className="flex-1 text-white/85">{t.name}</span>
                  <span className="text-white/55 tabular-nums">
                    {formatMoney(
                      t.lines.reduce((s, l) => s + l.amountCents, 0)
                    )}{" "}
                    · {t.dueDays} days
                  </span>
                  <Button
                    aria-label={`Delete ${t.name}`}
                    onClick={() => void removeTemplate(t)}
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 size={14} />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <p className="text-white/45 text-xs">
          Invoices for a proposal also appear on that proposal.{" "}
          <Link className="underline" to="/admin/proposals">
            Proposals
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
