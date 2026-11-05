import { ArrowDown, ArrowUp, Plus, RotateCcw, Trash2 } from "lucide-react";
import {
  type ContractClause,
  type ContractDoc,
  type ContractScope,
  defaultClauses,
} from "../../../config/contract.js";
import { newItemId } from "../../../config/proposal.js";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  proposalInputClass,
  proposalLabelClass,
  proposalTextareaClass,
} from "./proposalStyles";

/**
 * The editable body of an agreement: who it is between, the scope taken from
 * the proposal, and the clauses, each a heading and plain paragraphs.
 */

const SCOPE_FIELDS: { key: keyof ContractScope; label: string }[] = [
  { key: "option", label: "Option" },
  { key: "price", label: "Fee" },
  { key: "payment", label: "Payment" },
  { key: "timeline", label: "Timeline" },
  { key: "revisions", label: "Revisions" },
];

const toLines = (text: string): string[] =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

export function ContractTermsEditor({
  doc,
  onChange,
}: {
  doc: ContractDoc;
  onChange: (next: ContractDoc) => void;
}) {
  const setParties = (patch: Partial<ContractDoc["parties"]>) =>
    onChange({ ...doc, parties: { ...doc.parties, ...patch } });
  const setScope = (patch: Partial<ContractScope>) =>
    onChange({ ...doc, scope: { ...doc.scope, ...patch } });
  const setClause = (id: string, patch: Partial<ContractClause>) =>
    onChange({
      ...doc,
      clauses: doc.clauses.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });
  const move = (i: number, by: -1 | 1) => {
    const next = [...doc.clauses];
    const [item] = next.splice(i, 1);
    if (item) {
      next.splice(i + by, 0, item);
      onChange({ ...doc, clauses: next });
    }
  };

  const field = (
    id: string,
    label: string,
    value: string,
    set: (v: string) => void,
    type = "text"
  ) => (
    <div className="space-y-1.5" key={id}>
      <Label className={proposalLabelClass} htmlFor={id}>
        {label}
      </Label>
      <Input
        className={proposalInputClass}
        id={id}
        onChange={(e) => set(e.target.value)}
        type={type}
        value={value}
      />
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {field("ct-client", "Client name", doc.parties.clientName, (v) =>
          setParties({ clientName: v })
        )}
        {field("ct-company", "Client company", doc.parties.clientCompany, (v) =>
          setParties({ clientCompany: v })
        )}
        {field("ct-owner", "Your name", doc.parties.ownerName, (v) =>
          setParties({ ownerName: v })
        )}
        {field("ct-business", "Your business", doc.parties.ownerBusiness, (v) =>
          setParties({ ownerBusiness: v })
        )}
        {field(
          "ct-date",
          "Effective date",
          doc.effectiveDate,
          (v) => onChange({ ...doc, effectiveDate: v }),
          "date"
        )}
      </div>

      <div className="space-y-3">
        <h4 className={proposalLabelClass}>1 · Scope (from the proposal)</h4>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {SCOPE_FIELDS.map(({ key, label }) =>
            field(`ct-scope-${key}`, label, String(doc.scope[key]), (v) =>
              setScope({ [key]: v })
            )
          )}
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="space-y-1.5">
            <Label className={proposalLabelClass} htmlFor="ct-includes">
              Includes (one per line)
            </Label>
            <textarea
              className={proposalTextareaClass}
              id="ct-includes"
              onChange={(e) => setScope({ includes: toLines(e.target.value) })}
              value={doc.scope.includes.join("\n")}
            />
          </div>
          <div className="space-y-1.5">
            <Label className={proposalLabelClass} htmlFor="ct-addons">
              Also included (one per line)
            </Label>
            <textarea
              className={proposalTextareaClass}
              id="ct-addons"
              onChange={(e) => setScope({ addOns: toLines(e.target.value) })}
              placeholder="e.g. LinkedIn page banner and favicon"
              value={doc.scope.addOns.join("\n")}
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className={proposalLabelClass}>Terms</h4>
          <div className="flex items-center gap-1">
            <Button
              onClick={() => onChange({ ...doc, clauses: defaultClauses() })}
              title="Replace the clauses below with the current standard ones"
              type="button"
              variant="ghost"
            >
              <RotateCcw size={14} /> Standard clauses
            </Button>
            <Button
              onClick={() =>
                onChange({
                  ...doc,
                  clauses: [
                    ...doc.clauses,
                    { body: "", heading: "New clause", id: newItemId() },
                  ],
                })
              }
              type="button"
              variant="ghost"
            >
              <Plus size={14} /> Add clause
            </Button>
          </div>
        </div>
        {doc.clauses.map((clause, i) => (
          <div
            className="space-y-2 rounded-md border border-white/10 p-3"
            key={clause.id}
          >
            <div className="flex items-center gap-2">
              <span className="w-6 text-white/50 text-xs tabular-nums">
                {i + 2}
              </span>
              <Input
                aria-label="Clause heading"
                className={`${proposalInputClass} flex-1`}
                onChange={(e) =>
                  setClause(clause.id, { heading: e.target.value })
                }
                value={clause.heading}
              />
              <Button
                aria-label="Move up"
                disabled={i === 0}
                onClick={() => move(i, -1)}
                type="button"
                variant="ghost"
              >
                <ArrowUp size={14} />
              </Button>
              <Button
                aria-label="Move down"
                disabled={i === doc.clauses.length - 1}
                onClick={() => move(i, 1)}
                type="button"
                variant="ghost"
              >
                <ArrowDown size={14} />
              </Button>
              <Button
                aria-label="Remove clause"
                onClick={() =>
                  onChange({
                    ...doc,
                    clauses: doc.clauses.filter((c) => c.id !== clause.id),
                  })
                }
                type="button"
                variant="ghost"
              >
                <Trash2 size={14} />
              </Button>
            </div>
            <textarea
              aria-label={`${clause.heading} text`}
              className={proposalTextareaClass}
              onChange={(e) => setClause(clause.id, { body: e.target.value })}
              value={clause.body}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
