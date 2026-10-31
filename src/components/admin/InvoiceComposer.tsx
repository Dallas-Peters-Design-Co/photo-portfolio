import { Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  formatMoney,
  type Invoice,
  type InvoiceLine,
  type InvoiceTemplate,
  invoicesApi,
} from "../../services/activityService";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  proposalInputClass,
  proposalLabelClass,
  proposalTextareaClass,
} from "./proposalStyles";

/**
 * A new invoice, from a template or from scratch: who it's for, its lines,
 * how long they have, and a memo. It is saved as a local draft; sending it
 * through Stripe happens from the list, after a last look.
 */

interface LineDraft {
  amount: string;
  description: string;
  key: number;
}

const toCents = (dollars: string): number =>
  Math.round(Number(dollars.replaceAll(/[$,\s]/g, "")) * 100);

const toDrafts = (lines: InvoiceLine[]): LineDraft[] =>
  (lines.length > 0 ? lines : [{ amountCents: 0, description: "" }]).map(
    (l, i) => ({
      amount: l.amountCents ? (l.amountCents / 100).toFixed(2) : "",
      description: l.description,
      key: i,
    })
  );

export function InvoiceComposer({
  templates,
  onCreated,
  onTemplatesChange,
  onClose,
}: {
  onClose: () => void;
  onCreated: (invoice: Invoice) => void;
  onTemplatesChange: (next: InvoiceTemplate[]) => void;
  templates: InvoiceTemplate[];
}) {
  const [templateId, setTemplateId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [lines, setLines] = useState<LineDraft[]>(toDrafts([]));
  const [dueDays, setDueDays] = useState("14");
  const [memo, setMemo] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [busy, setBusy] = useState(false);

  const cleaned: InvoiceLine[] = lines
    .map((l) => ({
      amountCents: toCents(l.amount),
      description: l.description.trim(),
    }))
    .filter(
      (l) =>
        l.description && Number.isFinite(l.amountCents) && l.amountCents > 0
    );
  const total = cleaned.reduce((s, l) => s + l.amountCents, 0);
  const days = Number.parseInt(dueDays, 10);

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (t) {
      setLines(toDrafts(t.lines));
      setDueDays(String(t.dueDays));
      setMemo(t.memo);
      setTemplateName(t.name);
    }
  };

  const setLine = (key: number, patch: Partial<LineDraft>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const create = async () => {
    setBusy(true);
    try {
      onCreated(
        await invoicesApi.createStandalone({
          customerEmail: email.trim(),
          customerName: name.trim(),
          dueDays: Number.isInteger(days) ? days : 14,
          lines: cleaned,
          memo,
        })
      );
      toast.success("Draft saved. Send it from the list when it looks right.");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const saveTemplate = async () => {
    setBusy(true);
    try {
      const saved = await invoicesApi.saveTemplate({
        dueDays: Number.isInteger(days) ? days : 14,
        id: templateId || undefined,
        lines: cleaned,
        memo,
        name: templateName.trim(),
      });
      onTemplatesChange([...templates.filter((t) => t.id !== saved.id), saved]);
      setTemplateId(saved.id);
      toast.success(`Template "${saved.name}" saved`);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not save the template"
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 rounded-md border border-white/15 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label className={proposalLabelClass} htmlFor="inv-template">
            Start from
          </Label>
          <select
            className={`${proposalInputClass} w-full rounded-md border px-3`}
            id="inv-template"
            onChange={(e) => applyTemplate(e.target.value)}
            value={templateId}
          >
            <option value="">Blank invoice</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className={proposalLabelClass} htmlFor="inv-name">
            Client name
          </Label>
          <Input
            className={proposalInputClass}
            id="inv-name"
            onChange={(e) => setName(e.target.value)}
            value={name}
          />
        </div>
        <div className="space-y-1.5">
          <Label className={proposalLabelClass} htmlFor="inv-email">
            Client email
          </Label>
          <Input
            className={proposalInputClass}
            id="inv-email"
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            value={email}
          />
        </div>
      </div>

      <div className="space-y-2">
        <span className={proposalLabelClass}>Lines</span>
        {lines.map((line) => (
          <div
            className="grid grid-cols-[minmax(0,1fr)_9rem_auto] gap-2"
            key={line.key}
          >
            <Input
              aria-label="Description"
              className={proposalInputClass}
              onChange={(e) =>
                setLine(line.key, { description: e.target.value })
              }
              placeholder="What it's for"
              value={line.description}
            />
            <Input
              aria-label="Amount (USD)"
              className={`${proposalInputClass} tabular-nums`}
              inputMode="decimal"
              onChange={(e) => setLine(line.key, { amount: e.target.value })}
              placeholder="0.00"
              value={line.amount}
            />
            <Button
              aria-label="Remove line"
              disabled={lines.length === 1}
              onClick={() =>
                setLines((ls) => ls.filter((l) => l.key !== line.key))
              }
              type="button"
              variant="ghost"
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ))}
        <div className="flex items-center justify-between">
          <Button
            onClick={() =>
              setLines((ls) => [
                ...ls,
                {
                  amount: "",
                  description: "",
                  key: Math.max(0, ...ls.map((l) => l.key)) + 1,
                },
              ])
            }
            type="button"
            variant="ghost"
          >
            <Plus size={14} /> Add line
          </Button>
          <span className="text-sm text-white/80 tabular-nums">
            Total {formatMoney(total)}
          </span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
        <div className="space-y-1.5">
          <Label className={proposalLabelClass} htmlFor="inv-due">
            Due in (days)
          </Label>
          <Input
            className={`${proposalInputClass} tabular-nums`}
            id="inv-due"
            inputMode="numeric"
            onChange={(e) => setDueDays(e.target.value)}
            value={dueDays}
          />
        </div>
        <div className="space-y-1.5">
          <Label className={proposalLabelClass} htmlFor="inv-memo">
            Memo on the invoice (optional)
          </Label>
          <textarea
            className={`${proposalTextareaClass} min-h-11`}
            id="inv-memo"
            onChange={(e) => setMemo(e.target.value)}
            value={memo}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Button
          disabled={busy || cleaned.length === 0 || !email.trim()}
          onClick={() => void create()}
          title={email.trim() ? undefined : "Add the client's email"}
          type="button"
          variant="outline"
        >
          Save draft
        </Button>
        <Button onClick={onClose} type="button" variant="ghost">
          Cancel
        </Button>
        <div className="ml-auto flex items-end gap-2">
          <div className="space-y-1.5">
            <Label className={proposalLabelClass} htmlFor="inv-template-name">
              Template name
            </Label>
            <Input
              className={proposalInputClass}
              id="inv-template-name"
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Monthly retainer"
              value={templateName}
            />
          </div>
          <Button
            disabled={busy || !templateName.trim() || cleaned.length === 0}
            onClick={() => void saveTemplate()}
            type="button"
            variant="ghost"
          >
            <Save size={14} />{" "}
            {templateId ? "Update template" : "Save as template"}
          </Button>
        </div>
      </div>
    </div>
  );
}
