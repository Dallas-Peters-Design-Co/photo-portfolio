import { PenLine } from "lucide-react";
import { useState } from "react";
import {
  type ProposalRecord,
  proposalsApi,
} from "../../services/proposalService";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { proposalInputClass, proposalLabelClass } from "./proposalStyles";

/**
 * The agreement, drafted for the option the client chose when they said yes
 * by email or on a call rather than on the proposal page. Their choice is
 * recorded (as Accept would), which drafts the first invoice from the
 * option's payment terms, and the agreement is drafted from the same option.
 * Nothing is sent: the agreement goes for signature from its own section.
 */
export function RecordAcceptance({
  busy,
  onRecorded,
  proposal,
}: {
  busy: boolean;
  onRecorded: (next: ProposalRecord) => Promise<void>;
  proposal: ProposalRecord;
}) {
  const { packages } = proposal.doc;
  const [option, setOption] = useState(
    (packages.find((p) => p.recommended) ?? packages[0])?.id ?? ""
  );
  const [name, setName] = useState(proposal.clientName);
  const [how, setHow] = useState("By email");
  const [working, setWorking] = useState(false);
  const chosen = packages.find((p) => p.id === option);

  const record = async () => {
    setWorking(true);
    try {
      const next = await proposalsApi.accept(proposal.slug, {
        name: name.trim() || proposal.clientName,
        offline: true,
        option,
        title: how.trim(),
      });
      await onRecorded(next);
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-3 rounded-md bg-white/3 p-3">
      <p className="text-sm text-white/70">
        Pick the option {proposal.clientName || "the client"} chose (by email or
        on a call), and the agreement and first invoice are drafted for it.
        Nothing is sent: you check the agreement, then send it for their
        signature.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label className={proposalLabelClass} htmlFor="ra-option">
            Option they chose
          </Label>
          <select
            className={`${proposalInputClass} w-full rounded-md border px-3`}
            id="ra-option"
            onChange={(e) => setOption(e.target.value)}
            value={option}
          >
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.price}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className={proposalLabelClass} htmlFor="ra-name">
            Agreed by
          </Label>
          <Input
            className={proposalInputClass}
            id="ra-name"
            onChange={(e) => setName(e.target.value)}
            value={name}
          />
        </div>
        <div className="space-y-1.5">
          <Label className={proposalLabelClass} htmlFor="ra-how">
            How they told you
          </Label>
          <Input
            className={proposalInputClass}
            id="ra-how"
            onChange={(e) => setHow(e.target.value)}
            value={how}
          />
        </div>
      </div>
      <Button
        disabled={busy || working || !option}
        onClick={() => void record()}
        type="button"
        variant="outline"
      >
        <PenLine size={14} /> Draft agreement and invoice
        {chosen ? ` for ${chosen.name}` : ""}
      </Button>
    </div>
  );
}
