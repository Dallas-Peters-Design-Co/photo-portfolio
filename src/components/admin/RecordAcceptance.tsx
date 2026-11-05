import { CheckCircle2 } from "lucide-react";
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
 * For a client who said yes another way (an email, a call): record which
 * option they chose, by whom and how, as if they'd pressed Accept. That
 * drafts the first invoice from the option's payment terms; the agreement is
 * then drafted from the same option. Nobody is emailed.
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
        Accepted outside the site? Record it, and the agreement and first
        invoice are drafted from the option they chose.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label className={proposalLabelClass} htmlFor="ra-option">
            Option
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
            Accepted by
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
            How
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
        <CheckCircle2 size={14} /> Record and draft
        {chosen ? ` ${chosen.name}` : ""}
      </Button>
    </div>
  );
}
