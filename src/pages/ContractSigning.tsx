import { type FormEvent, useState } from "react";
import {
  type ContractRecord,
  contractPdfFilename,
  contractsApi,
} from "../services/contractService";
import { DesignerSignature, formatDate } from "./ProposalAcceptance";
import { downloadPagePdf } from "./pagePdf";

/**
 * Both signatures. The client's side is a form while the agreement is open
 * for signing; once signed it shows the name, title and date. The designer's
 * side waits until the owner countersigns in the admin, then shows the
 * handwritten signature dated that day.
 */
export function ContractSigning({
  contract,
  client,
  ownerName,
  onChange,
}: {
  client: string;
  contract: ContractRecord;
  onChange: (next: ContractRecord) => void;
  ownerName: string;
}) {
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const { clientSignature, ownerSignature, status } = contract;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onChange(await contractsApi.sign(contract.id, { agree, name, title }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign");
    } finally {
      setBusy(false);
    }
  };

  const downloadPdf = async () => {
    setRendering(true);
    setError(null);
    try {
      await downloadPagePdf(
        `/api/contracts/${contract.id}/pdf`,
        contractPdfFilename(contract)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not make the PDF");
    } finally {
      setRendering(false);
    }
  };

  const designerSide = ownerSignature ? (
    <DesignerSignature
      issued={formatDate(ownerSignature.at)}
      ownerName={ownerName}
    />
  ) : (
    <div>
      <p className="proposal-page__signed contract-page__pending">
        Awaiting signature
      </p>
      <span className="label">{ownerName} · the Designer</span>
      <span className="proposal-page__sig-note">
        Countersigned after you sign
      </span>
    </div>
  );

  if (clientSignature || status !== "sent") {
    return (
      <>
        <div className="proposal-page__signatures">
          {clientSignature ? (
            <div>
              <p className="proposal-page__signed">{clientSignature.name}</p>
              <span className="label">Signed for {client}</span>
              <span className="proposal-page__sig-note">
                {[clientSignature.title, formatDate(clientSignature.at)]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
          ) : (
            <div>
              <p className="proposal-page__signed contract-page__pending">
                Not yet signed
              </p>
              <span className="label">For {client}</span>
            </div>
          )}
          {designerSide}
        </div>
        <div className="proposal-page__actions">
          {status === "countersigned" ? (
            <span className="label proposal-page__accepted">
              Signed by both parties
            </span>
          ) : null}
          <button
            className="proposal-page__pdf"
            disabled={rendering}
            onClick={() => void downloadPdf()}
            type="button"
          >
            {rendering ? "Preparing PDF…" : "Download PDF"}
          </button>
        </div>
        {error ? <p className="proposal-page__error">{error}</p> : null}
      </>
    );
  }

  return (
    <form className="stack stack--snug" onSubmit={(e) => void submit(e)}>
      <div className="proposal-page__signatures">
        <div className="stack stack--tight">
          <input
            aria-label="Your full name"
            autoComplete="name"
            className="proposal-page__sig-input"
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            required
            value={name}
          />
          <input
            aria-label="Your title (optional)"
            autoComplete="organization-title"
            className="proposal-page__sig-input proposal-page__sig-input--quiet"
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            value={title}
          />
          <span className="label">Signing for {client}</span>
        </div>
        {designerSide}
      </div>
      <label className="contract-page__agree">
        <input
          checked={agree}
          onChange={(e) => setAgree(e.target.checked)}
          type="checkbox"
        />
        <span>
          I've read this agreement and agree to it. Typing my name above is my
          signature.
        </span>
      </label>
      {error ? <p className="proposal-page__error">{error}</p> : null}
      <div className="proposal-page__actions">
        <button
          className="proposal-page__accept"
          disabled={busy || !agree || !name.trim()}
          type="submit"
        >
          {busy ? "Signing…" : "Sign agreement"}
        </button>
      </div>
    </form>
  );
}
