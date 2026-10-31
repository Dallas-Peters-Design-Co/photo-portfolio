import "./ProposalPage.css";
import "./ContractPage.css";
import { type ReactNode, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { type ContractRecord, contractsApi } from "../services/contractService";
import { useSiteSettings } from "../theme/SiteSettingsProvider";
import { ContractSigning } from "./ContractSigning";
import { formatDate } from "./ProposalAcceptance";
import { proposalAccentStyle } from "./proposalAccent";
import { LOGO_PATH, LOGO_TRANSFORM, LOGO_VIEW_BOX } from "./siteLogo";

/**
 * A services agreement, as the client reads and signs it.
 *
 * The same sheet as the proposal it came from, so the two read as one set of
 * papers: the parties at the top, the scope as clause 1, the terms after it,
 * the signatures last. A draft resolves only while signed in; a sent one for
 * anyone with the link, which is an id nobody could guess.
 */
export function ContractPage() {
  const { id = "" } = useParams();
  const { settings } = useSiteSettings();
  const [contract, setContract] = useState<ContractRecord | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">(
    "loading"
  );

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    contractsApi
      .get(id)
      .then((record) => {
        if (!cancelled) {
          setContract(record);
          setState("ready");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState("missing");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (contract) {
      document.title = `${contract.title} — ${settings.ownerName}`;
    }
  }, [contract, settings.ownerName]);

  return (
    <div
      className="page proposal-page"
      style={proposalAccentStyle(settings.theme.accent)}
    >
      <header className="page__body proposal-page__masthead">
        <Link className="proposal-page__wordmark" to="/">
          <svg
            aria-hidden
            className="proposal-page__logo"
            fill="currentColor"
            height={20}
            viewBox={LOGO_VIEW_BOX}
            width={20}
          >
            <title>{settings.ownerName}</title>
            <g transform={LOGO_TRANSFORM}>
              <path d={LOGO_PATH} />
            </g>
          </svg>
          {settings.ownerName}
        </Link>
        <span className="label label--quiet">Agreement</span>
      </header>

      <main className="page__body proposal-page__main">
        {state === "loading" && <p className="label label--quiet">Loading</p>}
        {state === "missing" && (
          <div className="stack">
            <h1 className="proposal-page__notice-title">Agreement not found</h1>
            <p className="proposal-page__prose">
              This link may be out of date. Get in touch and I'll send it again.
            </p>
          </div>
        )}
        {state === "ready" && contract && (
          <ContractSheet
            contract={contract}
            onChange={setContract}
            ownerName={settings.ownerName}
          />
        )}
      </main>

      <footer className="hairline proposal-page__footer">
        <p className="label label--quiet">
          © {new Date().getFullYear()} {settings.ownerName}
        </p>
      </footer>
    </div>
  );
}

const PARAGRAPH = /\n\s*\n/;

function ContractSheet({
  contract,
  ownerName,
  onChange,
}: {
  contract: ContractRecord;
  ownerName: string;
  onChange: (next: ContractRecord) => void;
}) {
  const { doc } = contract;
  const { parties, scope } = doc;
  const client = parties.clientCompany || parties.clientName || "the Client";
  const facts = [
    { label: "Fee", value: scope.price },
    { label: "Payment", value: scope.payment },
    { label: "Timeline", value: scope.timeline },
    { label: "Revisions", value: scope.revisions },
  ].filter((f) => f.value);
  const signaturesN = doc.clauses.length + 2;

  return (
    <article className="proposal-page__sheet contract-page__sheet">
      <div className="proposal-page__content">
        <header className="proposal-page__header">
          <p className="label proposal-page__kicker">Services agreement</p>
          <h1 className="proposal-page__title">{contract.title}</h1>
          {contract.status === "draft" && (
            <p className="label proposal-page__draft">
              Draft — only visible to signed-in admins
            </p>
          )}
          <dl className="proposal-page__meta">
            <div>
              <dt className="label">Client</dt>
              <dd>
                {parties.clientName}
                {parties.clientCompany ? `, ${parties.clientCompany}` : ""}
              </dd>
            </div>
            <div>
              <dt className="label">Designer</dt>
              <dd>
                {parties.ownerName || ownerName}
                {parties.ownerBusiness ? `, ${parties.ownerBusiness}` : ""}
              </dd>
            </div>
            {doc.effectiveDate ? (
              <div>
                <dt className="label">Effective</dt>
                <dd>{formatDate(doc.effectiveDate)}</dd>
              </div>
            ) : null}
          </dl>
        </header>

        <Clause n={1} title={scope.option ? `Scope: ${scope.option}` : "Scope"}>
          {facts.length > 0 ? (
            <dl className="proposal-page__option-facts">
              {facts.map((f) => (
                <div key={f.label}>
                  <dt className="label">{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {scope.includes.length > 0 ? (
            <ul className="proposal-page__list">
              {scope.includes.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
          {scope.addOns.length > 0 ? (
            <>
              <p className="label contract-page__sub">Also included</p>
              <ul className="proposal-page__list">
                {scope.addOns.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </>
          ) : null}
        </Clause>

        {doc.clauses.map((clause, i) => (
          <Clause key={clause.id} n={i + 2} title={clause.heading}>
            {clause.body
              .split(PARAGRAPH)
              .map((p) => p.trim())
              .filter(Boolean)
              .map((p) => (
                <p className="proposal-page__prose" key={p.slice(0, 40)}>
                  {p}
                </p>
              ))}
          </Clause>
        ))}

        <Clause last n={signaturesN} title="Signatures">
          <ContractSigning
            client={client}
            contract={contract}
            onChange={onChange}
            ownerName={parties.ownerName || ownerName}
          />
        </Clause>
      </div>
    </article>
  );
}

function Clause({
  n,
  title,
  last,
  children,
}: {
  n: number;
  title: string;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={
        last
          ? "proposal-page__clause proposal-page__clause--last"
          : "proposal-page__clause"
      }
    >
      <div className="proposal-page__clause-head">
        <span aria-hidden className="proposal-page__clause-n">
          {String(n).padStart(2, "0")}
        </span>
        <h2 className="proposal-page__clause-title">{title}</h2>
      </div>
      <div className="proposal-page__clause-body">{children}</div>
    </section>
  );
}
