import {
  ExternalLink,
  FileSignature,
  PenLine,
  Send,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { ContractStatus } from "../../../config/contract.js";
import { downloadPagePdf } from "../../pages/pagePdf";
import { invoicesApi } from "../../services/activityService";
import {
  type ContractRecord,
  contractPdfFilename,
  contractsApi,
} from "../../services/contractService";
import type { ProposalRecord } from "../../services/proposalService";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { useConfirm } from "./ConfirmProvider";
import { ContractTermsEditor } from "./ContractTermsEditor";
import {
  proposalInputClass,
  proposalLabelClass,
  proposalTextareaClass,
} from "./proposalStyles";
import { RecordAcceptance } from "./RecordAcceptance";

/**
 * The services agreement for this proposal.
 *
 * Drafted from the proposal in one click (the chosen option's scope and
 * price, plus the standard clauses), edited here, then signed and sent: the
 * client's signature at its own link completes it. One sent unsigned is
 * countersigned here after the client signs. Once the client has signed
 * the text is frozen, so what was signed is what stays on file.
 */

/** Every invoice still a draft on this proposal, sent through Stripe. */
const sendDraftInvoices = async (slug: string) => {
  const { invoices } = await invoicesApi.list(slug);
  for (const invoice of invoices.filter((i) => i.status === "draft")) {
    // biome-ignore lint/performance/noAwaitInLoops: one at a time, so a failure stops before the next
    await invoicesApi.send(invoice.id);
  }
};

const STATUS: Record<ContractStatus, { cls: string; label: string }> = {
  countersigned: { cls: "text-emerald-300/90", label: "Signed by both" },
  draft: { cls: "text-amber-300/80", label: "Draft" },
  sent: { cls: "text-sky-300/90", label: "Sent, awaiting signature" },
  signed: { cls: "text-emerald-300/90", label: "Client signed — countersign" },
};

export function ProposalContract({
  proposal,
  onAccepted,
  onActivity,
}: {
  /** An acceptance recorded here (a client who said yes by email). */
  onAccepted: (next: ProposalRecord) => Promise<void>;
  onActivity: () => void;
  proposal: ProposalRecord;
}) {
  const { confirm } = useConfirm();
  const [contract, setContract] = useState<ContractRecord | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [note, setNote] = useState("");
  // Sending the agreement sends the drafted invoice(s) with it, by default.
  const [withInvoice, setWithInvoice] = useState(true);

  const load = useCallback(async () => {
    try {
      setContract(await contractsApi.forProposal(proposal.slug));
    } catch {
      setContract(null);
    } finally {
      setLoaded(true);
    }
  }, [proposal.slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (
    fn: () => Promise<ContractRecord | null | undefined>,
    done?: string
  ) => {
    setBusy(true);
    try {
      const next = await fn();
      if (next !== undefined) {
        setContract(next);
      }
      setDirty(false);
      if (done) {
        toast.success(done);
      }
      onActivity();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const edit = (patch: Partial<ContractRecord>) => {
    setContract((c) => (c ? { ...c, ...patch } : c));
    setDirty(true);
  };

  const save = (c: ContractRecord) =>
    contractsApi.update(c.id, {
      clientEmail: c.clientEmail,
      clientName: c.clientName,
      doc: c.doc,
      title: c.title,
    });

  const send = async (c: ContractRecord) => {
    if (!c.clientEmail) {
      toast.error("Add the client's email first.");
      return;
    }
    const signer = c.doc.parties.ownerName || "you";
    const ok = await confirm({
      confirmLabel: "Sign and send",
      description: `You sign it as ${signer}, then ${c.clientEmail} gets a link to read and sign it${withInvoice ? ", and Stripe emails the drafted invoice with a link to pay" : ""}. Their signature completes it, and you both get the signed copy.`,
      title: "Sign and send the agreement?",
    });
    if (ok) {
      await run(
        async () => {
          if (dirty) {
            await save(c);
          }
          const sent = await contractsApi.send(c.id, note, true);
          if (!sent.emailed) {
            toast.warning(
              "Saved as sent, but the email didn't go out. Share the link yourself."
            );
          }
          if (withInvoice) {
            await sendDraftInvoices(proposal.slug);
          }
          return sent;
        },
        withInvoice ? "Agreement and invoice sent" : "Agreement sent"
      );
    }
  };

  const remove = async (c: ContractRecord) => {
    const ok = await confirm({
      confirmLabel: "Delete",
      description: "You can draft a fresh one from the proposal afterwards.",
      title: "Delete this agreement?",
    });
    if (ok) {
      await run(async () => {
        await contractsApi.remove(c.id);
        return null;
      }, "Deleted");
    }
  };

  if (!loaded) {
    return null;
  }

  const status = contract ? STATUS[contract.status] : null;

  return (
    <section className="space-y-5 rounded-md border border-white/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-[11px] text-white/70 uppercase tracking-[0.2em]">
          <FileSignature size={14} /> Agreement
        </h3>
        {status ? (
          <span
            className={`text-[11px] uppercase tracking-[0.16em] ${status.cls}`}
          >
            {status.label}
          </span>
        ) : null}
      </div>

      {contract || proposal.acceptance ? null : (
        <RecordAcceptance
          busy={busy}
          onRecorded={async (next) => {
            await onAccepted(next);
            // Drafted from the option just recorded.
            await run(
              () => contractsApi.create(proposal.slug),
              "Agreement and first invoice drafted. Check it, then send it for signature."
            );
          }}
          proposal={proposal}
        />
      )}

      {contract || !proposal.acceptance ? null : (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-white/60">
            The client chose{" "}
            {proposal.doc.packages.find(
              (p) => p.id === proposal.acceptance?.option
            )?.name ?? "an option"}
            . Draft the agreement from it: scope, price and the standard terms,
            ready to edit and send for their signature.
          </p>
          <Button
            disabled={busy}
            onClick={() =>
              void run(
                () => contractsApi.create(proposal.slug),
                "Agreement drafted"
              )
            }
            type="button"
            variant="outline"
          >
            <PenLine size={14} /> Draft agreement
          </Button>
        </div>
      )}

      {contract?.status === "draft" ? (
        <label className="flex items-center gap-2 text-sm text-white/70">
          <input
            checked={withInvoice}
            onChange={(e) => setWithInvoice(e.target.checked)}
            type="checkbox"
          />
          Send the drafted invoice with it (Invoices, below)
        </label>
      ) : null}

      {contract?.status === "draft" ? (
        <DraftForm
          contract={contract}
          edit={edit}
          note={note}
          setNote={setNote}
        />
      ) : null}

      {contract ? (
        <ContractActions
          busy={busy}
          contract={contract}
          dirty={dirty}
          onCountersign={() =>
            void run(
              () => contractsApi.countersign(contract.id),
              "Countersigned. Copies are on their way."
            )
          }
          onRemove={() => void remove(contract)}
          onReopen={() =>
            void run(() => contractsApi.reopen(contract.id), "Back to draft")
          }
          onSave={() => void run(() => save(contract), "Saved")}
          onSend={() => void send(contract)}
        />
      ) : null}

      {contract ? <SignedLine contract={contract} /> : null}
    </section>
  );
}

function DraftForm({
  contract,
  edit,
  note,
  setNote,
}: {
  contract: ContractRecord;
  edit: (patch: Partial<ContractRecord>) => void;
  note: string;
  setNote: (v: string) => void;
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className={proposalLabelClass} htmlFor="ct-title">
            Title
          </Label>
          <Input
            className={proposalInputClass}
            id="ct-title"
            onChange={(e) => edit({ title: e.target.value })}
            value={contract.title}
          />
        </div>
        <div className="space-y-1.5">
          <Label className={proposalLabelClass} htmlFor="ct-email">
            Send to
          </Label>
          <Input
            className={proposalInputClass}
            id="ct-email"
            onChange={(e) => edit({ clientEmail: e.target.value || null })}
            type="email"
            value={contract.clientEmail ?? ""}
          />
        </div>
      </div>
      <ContractTermsEditor
        doc={contract.doc}
        onChange={(doc) => edit({ doc })}
      />
      <div className="space-y-1.5">
        <Label className={proposalLabelClass} htmlFor="ct-note">
          Note with the email (optional)
        </Label>
        <textarea
          className={proposalTextareaClass}
          id="ct-note"
          onChange={(e) => setNote(e.target.value)}
          placeholder="Here's the agreement with the changes we discussed…"
          value={note}
        />
      </div>
    </>
  );
}

function ContractActions({
  busy,
  contract,
  dirty,
  onCountersign,
  onRemove,
  onReopen,
  onSave,
  onSend,
}: {
  busy: boolean;
  contract: ContractRecord;
  dirty: boolean;
  onCountersign: () => void;
  onRemove: () => void;
  onReopen: () => void;
  onSave: () => void;
  onSend: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {contract.status === "draft" ? (
        <>
          <Button
            disabled={busy || !dirty}
            onClick={onSave}
            type="button"
            variant="outline"
          >
            {dirty ? "Save" : "Saved"}
          </Button>
          <Button
            disabled={busy}
            onClick={onSend}
            type="button"
            variant="outline"
          >
            <Send size={14} /> Sign and send
          </Button>
        </>
      ) : null}
      {contract.status === "sent" ? (
        <Button
          disabled={busy}
          onClick={onReopen}
          type="button"
          variant="ghost"
        >
          Reopen to edit
        </Button>
      ) : null}
      {contract.status === "signed" ? (
        <Button
          disabled={busy}
          onClick={onCountersign}
          type="button"
          variant="outline"
        >
          <PenLine size={14} /> Countersign
        </Button>
      ) : null}
      <a
        className="inline-flex items-center gap-1 text-[11px] text-white/80 uppercase tracking-[0.16em] hover:text-white"
        href={`/contract/${contract.id}`}
        rel="noreferrer"
        target="_blank"
      >
        <ExternalLink size={12} />{" "}
        {contract.status === "draft" ? "Preview" : "Open"}
      </a>
      <button
        className="text-[11px] text-white/80 uppercase tracking-[0.16em] hover:text-white disabled:text-white/40"
        disabled={busy}
        onClick={() =>
          void downloadPagePdf(
            `/api/contracts/${contract.id}/pdf`,
            contractPdfFilename(contract)
          ).catch((e: unknown) =>
            toast.error(
              e instanceof Error ? e.message : "Could not make the PDF"
            )
          )
        }
        type="button"
      >
        PDF
      </button>
      {contract.status === "draft" || contract.status === "sent" ? (
        <Button
          aria-label="Delete agreement"
          className="ml-auto"
          disabled={busy}
          onClick={onRemove}
          type="button"
          variant="ghost"
        >
          <Trash2 size={14} />
        </Button>
      ) : null}
    </div>
  );
}

function SignedLine({ contract }: { contract: ContractRecord }) {
  const { clientSignature: client, ownerSignature: owner } = contract;
  const day = (at: string) => new Date(at).toLocaleDateString();
  const theirs = client
    ? `signed by ${client.name}${client.title ? `, ${client.title}` : ""} on ${day(client.at)}`
    : null;
  const parts = [
    owner ? `Signed by ${owner.name} on ${day(owner.at)}` : null,
    theirs ?? (owner ? "waiting for the client's signature" : null),
  ].filter(Boolean);
  if (parts.length === 0) {
    return null;
  }
  const line = parts.join("; ");
  return (
    <p className="text-sm text-white/60">
      {line.charAt(0).toUpperCase() + line.slice(1)}.
    </p>
  );
}
