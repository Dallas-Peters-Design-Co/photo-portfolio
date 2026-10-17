import { type FormEvent, useState } from "react";
import { type ProposalRecord, proposalsApi } from "../services/proposalService";
import { downloadProposalPdf } from "./proposalPdf";

/**
 * The signature block. The client's side is a form until it has been
 * signed; the designer's side is already signed, dated the day the
 * proposal was issued. Accepting records name, title and the chosen option
 * on the proposal, after which both sides read as signed and the form is
 * gone, for this reader and every later one.
 */
export function ProposalAcceptance({
  proposal,
  ownerName,
  issued,
  onAccepted,
}: {
  proposal: ProposalRecord;
  ownerName: string;
  issued: string;
  onAccepted: (next: ProposalRecord) => void;
}) {
  const suggested = proposal.doc.packages.find((p) => p.recommended);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [option, setOption] = useState(
    suggested?.id ?? proposal.doc.packages[0]?.id ?? ""
  );
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copySent, setCopySent] = useState<boolean | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const signedFor = proposal.brand?.name || proposal.clientName || "the Client";
  const { acceptance } = proposal;
  const chosen = acceptance
    ? proposal.doc.packages.find((p) => p.id === acceptance.option)
    : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSending) {
      return;
    }
    setIsSending(true);
    setError(null);
    try {
      const next = await proposalsApi.accept(proposal.slug, {
        name: name.trim(),
        option,
        title: title.trim(),
      });
      setCopySent(next.emailed.client);
      onAccepted(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept");
    } finally {
      setIsSending(false);
    }
  };

  // The PDF is the page itself, printed by a browser on the server, so it
  // follows the stylesheet exactly, signed or not. It takes a few seconds.
  const downloadPdf = async () => {
    if (isRendering) {
      return;
    }
    setIsRendering(true);
    setPdfError(null);
    try {
      await downloadProposalPdf(proposal);
    } catch (err) {
      setPdfError(
        err instanceof Error ? err.message : "Could not make the PDF"
      );
    } finally {
      setIsRendering(false);
    }
  };

  const pdfButton = (
    <>
      <button
        className="proposal-page__pdf"
        disabled={isRendering}
        onClick={() => void downloadPdf()}
        type="button"
      >
        {isRendering ? "Preparing PDF…" : "Download PDF"}
      </button>
      {pdfError ? <p className="proposal-page__error">{pdfError}</p> : null}
    </>
  );

  if (acceptance) {
    return (
      <>
        <div className="proposal-page__signatures">
          <div>
            <p className="proposal-page__signed">{acceptance.name}</p>
            <span className="label">Signed for {signedFor}</span>
            <span className="proposal-page__sig-note">
              {[acceptance.title, formatDate(acceptance.at)]
                .filter(Boolean)
                .join(" · ")}
              {chosen ? ` · ${chosen.name}` : ""}
            </span>
          </div>
          <div>
            <p className="proposal-page__signed">{ownerName}</p>
            <span className="label">Signed by the Designer</span>
            <span className="proposal-page__sig-note">{issued}</span>
          </div>
        </div>
        <div className="proposal-page__actions">
          <span className="label proposal-page__accepted">
            {copySent === true
              ? "Accepted · a copy is on its way to your inbox"
              : "Accepted"}
          </span>
          {pdfButton}
        </div>
      </>
    );
  }

  return (
    <form className="stack stack--snug" onSubmit={(e) => void submit(e)}>
      {proposal.doc.packages.length > 1 ? (
        <fieldset className="proposal-page__choice">
          <legend className="label">Option accepted</legend>
          {proposal.doc.packages.map((p) => (
            <label className="proposal-page__choice-item" key={p.id}>
              <input
                checked={option === p.id}
                name="option"
                onChange={() => setOption(p.id)}
                type="radio"
                value={p.id}
              />
              <span>
                {p.name}
                <span className="proposal-page__sig-note"> {p.price}</span>
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}
      <div className="proposal-page__signatures">
        <div className="stack stack--tight">
          <input
            aria-label="Your name"
            autoComplete="name"
            className="proposal-page__sig-input"
            onChange={(e) => setName(e.target.value)}
            placeholder="Type your full name to sign"
            required
            value={name}
          />
          <input
            aria-label="Your title"
            autoComplete="organization-title"
            className="proposal-page__sig-input proposal-page__sig-input--quiet"
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            value={title}
          />
          <span className="label">Signed for {signedFor}</span>
        </div>
        <div>
          <p className="proposal-page__signed">{ownerName}</p>
          <span className="label">Signed by the Designer</span>
          <span className="proposal-page__sig-note">{issued}</span>
        </div>
      </div>
      {error ? <p className="proposal-page__error">{error}</p> : null}
      <div className="proposal-page__actions">
        <button
          className="proposal-page__accept"
          disabled={isSending || !name.trim()}
          type="submit"
        >
          {isSending ? "Signing…" : "Accept and sign"}
        </button>
        {pdfButton}
      </div>
    </form>
  );
}

export const formatDate = (iso: string): string => {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
};
