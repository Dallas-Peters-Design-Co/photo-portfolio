import Cancel01Icon from "@hugeicons-pro/core-stroke-standard/Cancel01Icon";
import Delete02Icon from "@hugeicons-pro/core-stroke-standard/Delete02Icon";
import Invoice01Icon from "@hugeicons-pro/core-stroke-standard/Invoice01Icon";
import LinkSquare02Icon from "@hugeicons-pro/core-stroke-standard/LinkSquare02Icon";
import SentIcon from "@hugeicons-pro/core-stroke-standard/SentIcon";
import { Plus, X } from "lucide-react";
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
import {
  AdminEmpty,
  AdminList,
  AdminListHeading,
  AdminListNote,
  AdminListPage,
  AdminListRow,
  AdminRowAction,
  AdminStatus,
} from "./AdminList";
import { useConfirm } from "./ConfirmProvider";
import { InvoiceComposer } from "./InvoiceComposer";

/**
 * Every invoice in one place: the ones drafted from proposals and the ones
 * made here for any client, with the templates they can start from. Sending
 * creates the invoice in Stripe, which emails it with a pay link; from then
 * its status follows Stripe's webhooks.
 */

const STATUS: Record<
  Invoice["status"],
  { label: string; tone: "done" | "draft" | "pending" | "void" }
> = {
  draft: { label: "Draft", tone: "draft" },
  open: { label: "Sent, unpaid", tone: "pending" },
  paid: { label: "Paid", tone: "done" },
  uncollectible: { label: "Uncollectible", tone: "void" },
  void: { label: "Void", tone: "void" },
};

const amountClass = "text-sm text-white/90 tabular-nums";

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
    <AdminListPage
      action={
        <Button
          onClick={() => setComposing((v) => !v)}
          type="button"
          variant="ghost"
        >
          {composing ? <X size={14} /> : <Plus size={14} />}
          {composing ? "Cancel" : "New invoice"}
        </Button>
      }
      aside={
        outstanding > 0 ? (
          <AdminStatus tone="pending">
            {formatMoney(outstanding)} outstanding
          </AdminStatus>
        ) : null
      }
      icon={Invoice01Icon}
      title="Invoices"
    >
      {stripe ? null : (
        <AdminListNote tone="warn">
          Stripe isn't connected (STRIPE_SECRET_KEY), so drafts can be made but
          not sent.
        </AdminListNote>
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
        <AdminEmpty>No invoices yet.</AdminEmpty>
      ) : (
        <AdminList>
          {invoices.map((inv) => (
            <AdminListRow
              actions={
                <>
                  {inv.status === "draft" ? (
                    <>
                      <AdminRowAction
                        disabled={
                          !stripe || busy === inv.id || !inv.customerEmail
                        }
                        icon={SentIcon}
                        label="Send"
                        onClick={() => void act(inv, "send")}
                      />
                      <AdminRowAction
                        danger
                        disabled={busy === inv.id}
                        icon={Delete02Icon}
                        label="Delete draft"
                        onClick={() => void act(inv, "remove")}
                      />
                    </>
                  ) : null}
                  {inv.status === "open" ? (
                    <AdminRowAction
                      danger
                      disabled={busy === inv.id}
                      icon={Cancel01Icon}
                      label="Void"
                      onClick={() => void act(inv, "void")}
                    />
                  ) : null}
                  {inv.hostedUrl ? (
                    <AdminRowAction
                      href={inv.hostedUrl}
                      icon={LinkSquare02Icon}
                      label="Open the client's invoice"
                    />
                  ) : null}
                </>
              }
              key={inv.id}
              meta={inv.lines.map((l) => l.description).join(" · ")}
              status={
                <>
                  <span className={amountClass}>
                    {formatMoney(inv.amountCents, inv.currency)}
                  </span>
                  <AdminStatus tone={STATUS[inv.status].tone}>
                    {STATUS[inv.status].label}
                  </AdminStatus>
                </>
              }
              title={`${inv.number ? `${inv.number} · ` : ""}${
                inv.customerName || inv.customerEmail || "No client yet"
              }`}
            />
          ))}
        </AdminList>
      )}

      <AdminListHeading>Templates</AdminListHeading>
      {templates.length === 0 ? (
        <AdminEmpty>
          Save one from a new invoice: a deposit, a monthly retainer, an hourly
          block.
        </AdminEmpty>
      ) : (
        <AdminList>
          {templates.map((t) => (
            <AdminListRow
              actions={
                <AdminRowAction
                  danger
                  icon={Delete02Icon}
                  label={`Delete ${t.name}`}
                  onClick={() => void removeTemplate(t)}
                />
              }
              key={t.id}
              meta={`${t.dueDays} days`}
              status={
                <span className={amountClass}>
                  {formatMoney(t.lines.reduce((s, l) => s + l.amountCents, 0))}
                </span>
              }
              title={t.name}
            />
          ))}
        </AdminList>
      )}

      <AdminListNote>
        Invoices for a proposal also appear on that proposal.{" "}
        <Link className="underline" to="/admin/proposals">
          Proposals
        </Link>
      </AdminListNote>
    </AdminListPage>
  );
}
