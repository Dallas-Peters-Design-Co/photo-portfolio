import "./ProposalPage.css";
import { type ReactNode, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  isRichTextEmpty,
  type ProposalPackage,
  type RichText,
  type TextBlock,
  textToBlocks,
} from "../../config/proposal.js";
import { PageContent } from "../cms/PageContent";
import { type ProposalRecord, proposalsApi } from "../services/proposalService";
import { siteConfig } from "../site";
import { useSiteSettings } from "../theme/SiteSettingsProvider";
import { formatDate, ProposalAcceptance } from "./ProposalAcceptance";
import { LOGO_PATH, LOGO_TRANSFORM, LOGO_VIEW_BOX } from "./proposalPdf/logo";

/**
 * The proposal as the client reads it: a numbered agreement on a sheet.
 *
 * The page is a document, not a product screen. The parties sit in two boxes
 * at the top, everything after is a numbered clause (scope, options and fees,
 * add-ons, the working sections, next steps, terms) and it ends on an
 * acceptance block. The options are clauses 2.1 to 2.3 with the fee in the
 * margin, so the money reads as part of the agreement rather than a pricing
 * grid dropped into it.
 *
 * A draft resolves only while signed in, so it can be checked at its real
 * address before the link is sent.
 */
export function ProposalPage() {
  const { slug = "" } = useParams();
  const { settings } = useSiteSettings();
  const [proposal, setProposal] = useState<ProposalRecord | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">(
    "loading"
  );

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    void (async () => {
      try {
        const record = await proposalsApi.get(slug);
        if (!cancelled) {
          setProposal(record);
          setState("ready");
        }
      } catch {
        if (!cancelled) {
          setState("missing");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (proposal) {
      document.title = `${proposal.title} — ${settings.ownerName}`;
    }
  }, [proposal, settings.ownerName]);

  return (
    <div className="page proposal-page">
      <header className="page__body proposal-page__masthead">
        <Link className="proposal-page__wordmark" to="/">
          {/*
            The mark inline, in the text colour: the favicon file carries its
            own fills (the brand blue, a dark-mode rule), which is right for a
            browser tab and wrong on the site's dark masthead, where it has
            to read in the foreground like the wordmark beside it.
          */}
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
        <span className="label label--quiet">Proposal</span>
      </header>

      <main className="page__body proposal-page__main">
        {state === "loading" && <p className="label label--quiet">Loading</p>}

        {state === "missing" && (
          <div className="stack">
            <h1 className="proposal-page__notice-title">Proposal not found</h1>
            <p className="proposal-page__prose">
              This link may have expired or the proposal has been withdrawn. Get
              in touch and I'll send a fresh one.
            </p>
          </div>
        )}

        {state === "ready" && proposal && (
          <ProposalSheet
            onAccepted={setProposal}
            ownerName={settings.ownerName}
            proposal={proposal}
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

function ProposalSheet({
  proposal,
  ownerName,
  onAccepted,
}: {
  proposal: ProposalRecord;
  ownerName: string;
  onAccepted: (next: ProposalRecord) => void;
}) {
  const { doc } = proposal;
  const issued = formatDate(proposal.updatedAt);
  const validity = doc.validUntil
    ? ` · Valid until ${formatDate(doc.validUntil)}`
    : "";

  // Clauses are numbered in the order they render, so a proposal with no
  // add-ons or no process steps still counts 1, 2, 3 without a gap. The
  // numbers are settled here, in render order, rather than inside the JSX.
  let clause = 0;
  const next = () => {
    clause += 1;
    return clause;
  };
  const scopeN = isRichTextEmpty(doc.summary) ? 0 : next();
  const sectionNs = doc.sections.map(() => next());
  const optionsN = doc.packages.length > 0 ? next() : 0;
  const addOnsN = doc.addOns.length > 0 ? next() : 0;
  const processN = doc.process.length > 0 ? next() : 0;
  const termsN = doc.terms.length > 0 ? next() : 0;
  const acceptanceN = next();

  return (
    <article className="proposal-page__sheet">
      <header className="stack stack--tight">
        <p className="label proposal-page__kicker">
          Design proposal · {issued}
          {validity}
        </p>
        <h1 className="proposal-page__title">{proposal.title}</h1>
        {proposal.status === "draft" && (
          <p className="label proposal-page__draft">
            Draft — only visible to signed-in admins
          </p>
        )}
      </header>

      <div className="proposal-page__parties">
        <dl className="proposal-page__party">
          <dt className="label">Client</dt>
          <dd>{proposal.clientName || "—"}</dd>
          {proposal.brand ? (
            <>
              <dt className="label">Company</dt>
              <dd>{proposal.brand.name}</dd>
            </>
          ) : null}
          <dt className="label">Referred to as</dt>
          <dd>Client</dd>
        </dl>
        <dl className="proposal-page__party">
          <dt className="label">Designer</dt>
          <dd>{ownerName}</dd>
          <dt className="label">Practice</dt>
          <dd>
            {siteConfig.tagline}, {siteConfig.domain}
          </dd>
          <dt className="label">Referred to as</dt>
          <dd>Designer</dd>
        </dl>
      </div>

      {isRichTextEmpty(doc.intro) ? null : (
        <div className="proposal-page__intro">
          <Prose text={doc.intro} />
        </div>
      )}

      {scopeN ? (
        <Clause n={scopeN} title="Scope of work">
          <Prose text={doc.summary} />
        </Clause>
      ) : null}

      {doc.sections.map((section, i) => (
        <Clause key={section.id} n={sectionNs[i] ?? 0} title={section.heading}>
          <Prose text={section.body} />
        </Clause>
      ))}

      {optionsN ? (
        <Clause n={optionsN} title="Options and fees">
          {doc.packages.map((pkg, i) => (
            <Option index={`${optionsN}.${i + 1}`} key={pkg.id} pkg={pkg} />
          ))}
        </Clause>
      ) : null}

      {addOnsN ? (
        <Clause n={addOnsN} title="Add-ons">
          <dl className="proposal-page__addons">
            {doc.addOns.map((addOn) => (
              <div className="proposal-page__addon" key={addOn.id}>
                <dt>{addOn.name}</dt>
                <dd>{addOn.price}</dd>
              </div>
            ))}
          </dl>
        </Clause>
      ) : null}

      {processN ? (
        <Clause n={processN} title="What happens next">
          <ol className="proposal-page__steps">
            {doc.process.map((step) => (
              <li className="proposal-page__step" key={step.id}>
                <span className="proposal-page__run">{step.title}.</span>{" "}
                {step.body}
              </li>
            ))}
          </ol>
        </Clause>
      ) : null}

      {termsN ? (
        <Clause n={termsN} title="Terms">
          <ul className="proposal-page__list">
            {doc.terms.map((term) => (
              <li key={term}>{term}</li>
            ))}
          </ul>
        </Clause>
      ) : null}

      <Clause last n={acceptanceN} title="Acceptance">
        {isRichTextEmpty(doc.closing) ? null : <Prose text={doc.closing} />}
        <ProposalAcceptance
          issued={issued}
          onAccepted={onAccepted}
          ownerName={ownerName}
          proposal={proposal}
        />
      </Clause>
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
  const cls = last
    ? "proposal-page__clause proposal-page__clause--last"
    : "proposal-page__clause";
  return (
    <section className={cls}>
      <h2 className="proposal-page__clause-title">
        {n}. {title}
      </h2>
      <div className="stack stack--snug">{children}</div>
    </section>
  );
}

function Option({ index, pkg }: { index: string; pkg: ProposalPackage }) {
  const cls = pkg.recommended
    ? "proposal-page__option proposal-page__option--suggested"
    : "proposal-page__option";
  const facts = [pkg.timeline, pkg.revisions, pkg.payment].filter(Boolean);
  return (
    <div className={cls}>
      <span className="proposal-page__option-index">{index}</span>
      <div className="stack stack--tight">
        <p className="proposal-page__prose">
          <span className="proposal-page__run">
            {pkg.name}
            {pkg.recommended ? " (suggested)" : ""}.
          </span>{" "}
          {pkg.bestFor}
        </p>
        {facts.length > 0 ? (
          <p className="proposal-page__option-facts">{facts.join(" · ")}</p>
        ) : null}
        {pkg.includes.length > 0 ? (
          <ul className="proposal-page__list proposal-page__list--small">
            {pkg.includes.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
      </div>
      <span className="proposal-page__option-fee">
        {pkg.price}
        {pkg.priceNote ? (
          <span className="proposal-page__option-fee-note">
            {pkg.priceNote}
          </span>
        ) : null}
      </span>
    </div>
  );
}

/** Rich text from the editor, or the plain text older proposals carry. */
function Prose({ text }: { text: RichText }) {
  if (typeof text !== "string") {
    return <PageContent doc={text} />;
  }
  const blocks = textToBlocks(text);
  return (
    <>
      {blocks.map((block, index) => (
        <ProseBlock block={block} key={blockKey(block, index)} />
      ))}
    </>
  );
}

function ProseBlock({ block }: { block: TextBlock }) {
  if (block.kind === "list") {
    return (
      <ul className="proposal-page__list">
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }
  return <p className="proposal-page__prose">{block.text}</p>;
}

const blockKey = (block: TextBlock, index: number): string =>
  block.kind === "list"
    ? `list-${index}-${block.items[0] ?? ""}`
    : `p-${index}-${block.text.slice(0, 24)}`;
