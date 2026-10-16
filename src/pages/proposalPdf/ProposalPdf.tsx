import { Document, G, Page, Path, Svg, Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import {
  isRichTextEmpty,
  type ProposalPackage,
} from "../../../config/proposal.js";
import type { ProposalRecord } from "../../services/proposalService";
import { LOGO_PATH, LOGO_TRANSFORM, LOGO_VIEW_BOX } from "./logo";
import { PdfRichText } from "./richText";
import { BLUE, styles } from "./styles";

/**
 * The proposal as a PDF, laid out like the page: the parties in two boxes,
 * then the numbered clauses in the same order and with the same numbers the
 * web sheet shows, ending on the signatures. Signed, it carries the name and
 * date on the client's line; unsigned, the line is blank to sign by hand.
 *
 * Built from the same record the page renders, so the two cannot disagree
 * about a price or a clause number.
 */

export interface ProposalPdfInput {
  domain: string;
  issued: string;
  ownerName: string;
  proposal: ProposalRecord;
  tagline: string;
  validUntil: string;
}

export function ProposalPdf({
  proposal,
  ownerName,
  domain,
  tagline,
  issued,
  validUntil,
}: ProposalPdfInput) {
  const { doc } = proposal;
  const {
    scopeN,
    sectionNs,
    optionsN,
    addOnsN,
    processN,
    termsN,
    acceptanceN,
  } = numberClauses(doc);

  return (
    <Document
      author={ownerName}
      subject="Design proposal"
      title={proposal.title}
    >
      <Page size="LETTER" style={styles.page}>
        <View fixed style={styles.masthead}>
          <View style={styles.wordmark}>
            <Svg height={14} viewBox={LOGO_VIEW_BOX} width={14}>
              <G transform={LOGO_TRANSFORM}>
                <Path d={LOGO_PATH} fill={BLUE} />
              </G>
            </Svg>
            <Text>{ownerName}</Text>
          </View>
          <Text style={styles.label}>Proposal</Text>
        </View>

        <View style={styles.body}>
          <Text style={styles.kicker}>
            Design proposal · {issued}
            {validUntil ? ` · Valid until ${validUntil}` : ""}
          </Text>
          <Text style={styles.title}>{proposal.title}</Text>

          <View style={styles.parties}>
            <View style={styles.party}>
              <Party first label="Client" value={proposal.clientName || "—"} />
              {proposal.brand ? (
                <Party label="Company" value={proposal.brand.name} />
              ) : null}
              <Party label="Referred to as" value="Client" />
            </View>
            <View style={styles.party}>
              <Party first label="Designer" value={ownerName} />
              <Party label="Practice" value={`${tagline}, ${domain}`} />
              <Party label="Referred to as" value="Designer" />
            </View>
          </View>

          {isRichTextEmpty(doc.intro) ? null : (
            <PdfRichText value={doc.intro} />
          )}

          {scopeN ? (
            <Clause n={scopeN} title="Scope of work">
              <PdfRichText value={doc.summary} />
            </Clause>
          ) : null}

          {doc.sections.map((section, i) => (
            <Clause
              key={section.id}
              n={sectionNs[i] ?? 0}
              title={section.heading}
            >
              <PdfRichText value={section.body} />
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
              {doc.addOns.map((addOn, i) => (
                <View
                  key={addOn.id}
                  style={
                    i === doc.addOns.length - 1
                      ? [styles.addon, styles.addonLast]
                      : styles.addon
                  }
                >
                  <Text>{addOn.name}</Text>
                  <Text style={styles.addonPrice}>{addOn.price}</Text>
                </View>
              ))}
            </Clause>
          ) : null}

          {processN ? (
            <Clause n={processN} title="What happens next">
              {doc.process.map((step, i) => (
                <View key={step.id} style={styles.step}>
                  <Text style={styles.stepNumber}>{i + 1}.</Text>
                  <Text style={styles.stepText}>
                    <Text style={styles.run}>{step.title}.</Text> {step.body}
                  </Text>
                </View>
              ))}
            </Clause>
          ) : null}

          {termsN ? (
            <Clause n={termsN} title="Terms">
              {doc.terms.map((term) => (
                <View key={term} style={styles.bullet}>
                  <Text style={styles.bulletMark}>•</Text>
                  <Text style={styles.bulletText}>{term}</Text>
                </View>
              ))}
            </Clause>
          ) : null}

          <Clause last n={acceptanceN} title="Acceptance">
            {isRichTextEmpty(doc.closing) ? null : (
              <PdfRichText value={doc.closing} />
            )}
            <Signatures
              issued={issued}
              ownerName={ownerName}
              proposal={proposal}
            />
          </Clause>
        </View>

        <Text
          fixed
          render={({ pageNumber, totalPages }) =>
            `${proposal.title} · ${ownerName} · ${pageNumber} / ${totalPages}`
          }
          style={styles.footer}
        />
      </Page>
    </Document>
  );
}

/**
 * Clause numbers in render order, so a proposal with no add-ons or no steps
 * still counts 1, 2, 3 without a gap; the same rule the page applies.
 */
const numberClauses = (doc: ProposalRecord["doc"]) => {
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
  return {
    acceptanceN,
    addOnsN,
    optionsN,
    processN,
    scopeN,
    sectionNs,
    termsN,
  };
};

function Signatures({
  proposal,
  ownerName,
  issued,
}: {
  proposal: ProposalRecord;
  ownerName: string;
  issued: string;
}) {
  const signedFor = proposal.brand?.name || proposal.clientName || "the Client";
  const { acceptance } = proposal;
  const chosen = acceptance
    ? proposal.doc.packages.find((p) => p.id === acceptance.option)
    : null;
  const note = acceptance
    ? [acceptance.title, formatPdfDate(acceptance.at)]
        .filter(Boolean)
        .join(" · ") + (chosen ? ` · ${chosen.name}` : "")
    : "Name, title and date";
  return (
    <View style={styles.signatures} wrap={false}>
      <View style={styles.sigBlock}>
        <Text style={styles.sigLine}>{acceptance?.name ?? " "}</Text>
        <Text style={styles.label}>Signed for {signedFor}</Text>
        <Text style={styles.sigNote}>{note}</Text>
      </View>
      <View style={styles.sigBlock}>
        <Text style={styles.sigLine}>{ownerName}</Text>
        <Text style={styles.label}>Signed by the Designer</Text>
        <Text style={styles.sigNote}>{issued}</Text>
      </View>
    </View>
  );
}

function Party({
  label,
  value,
  first,
}: {
  label: string;
  value: string;
  first?: boolean;
}) {
  return (
    <>
      <Text
        style={
          first
            ? [styles.partyLabel, styles.partyLabelFirst]
            : styles.partyLabel
        }
      >
        {label}
      </Text>
      <Text style={styles.partyValue}>{value}</Text>
    </>
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
    <View style={last ? [styles.clause, styles.clauseLast] : styles.clause}>
      <Text minPresenceAhead={80} style={styles.clauseTitle}>
        {n}. {title}
      </Text>
      {children}
    </View>
  );
}

function Option({ index, pkg }: { index: string; pkg: ProposalPackage }) {
  const facts = [pkg.timeline, pkg.revisions, pkg.payment].filter(Boolean);
  return (
    <View
      style={
        pkg.recommended
          ? [styles.option, styles.optionSuggested]
          : styles.option
      }
      wrap={false}
    >
      <Text style={styles.optionIndex}>{index}</Text>
      <View style={styles.optionBody}>
        <Text>
          <Text style={styles.run}>
            {pkg.name}
            {pkg.recommended ? " (suggested)" : ""}.
          </Text>{" "}
          {pkg.bestFor}
        </Text>
        {facts.length > 0 ? (
          <Text style={styles.optionFacts}>{facts.join(" · ")}</Text>
        ) : null}
        {pkg.includes.length > 0 ? (
          <View style={styles.optionIncludes}>
            {pkg.includes.map((line) => (
              <View key={line} style={styles.bullet}>
                <Text style={styles.bulletMark}>•</Text>
                <Text style={styles.bulletText}>{line}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      <View style={styles.optionFeeBox}>
        <Text style={styles.optionFee}>{pkg.price}</Text>
        {pkg.priceNote ? (
          <Text style={styles.optionFeeNote}>{pkg.priceNote}</Text>
        ) : null}
      </View>
    </View>
  );
}

/** A date for the signature line, without depending on the browser locale. */
export const formatPdfDate = (iso: string): string => {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
};
