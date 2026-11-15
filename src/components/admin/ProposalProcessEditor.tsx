import { Plus, Trash2 } from "lucide-react";
import {
  newItemId,
  type ProposalDoc,
  type ProposalStep,
} from "../../../config/proposal.js";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { proposalTextareaClass } from "./proposalStyles";

/** "What happens next": the proposal's numbered steps, each a title and a line. */
export function ProposalProcessEditor({
  doc,
  onChange,
  titleClass,
}: {
  doc: ProposalDoc;
  onChange: (patch: Partial<ProposalDoc>) => void;
  /** The section heading's class, shared with the editor's other sections. */
  titleClass: string;
}) {
  const updateStep = (id: string, patch: Partial<ProposalStep>) =>
    onChange({
      process: doc.process.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className={titleClass}>What happens next</h3>
        <Button
          onClick={() =>
            onChange({
              process: [
                ...doc.process,
                { body: "", id: newItemId(), title: "" },
              ],
            })
          }
          type="button"
          variant="ghost"
        >
          <Plus size={14} /> Add step
        </Button>
      </div>
      {doc.process.map((step, index) => (
        <div
          className="flex flex-col gap-3 rounded-md border border-white/10 p-4 sm:flex-row sm:items-start"
          key={step.id}
        >
          <div className="sm:flex-1">
            <Input
              aria-label={`Step ${index + 1} title`}
              onChange={(e) => updateStep(step.id, { title: e.target.value })}
              placeholder={`Step ${index + 1}`}
              size="lg"
              value={step.title}
            />
          </div>
          <textarea
            aria-label={`Step ${index + 1} detail`}
            className={`${proposalTextareaClass} min-h-11 sm:flex-2`}
            onChange={(e) => updateStep(step.id, { body: e.target.value })}
            value={step.body}
          />
          <Button
            aria-label="Remove step"
            onClick={() =>
              onChange({
                process: doc.process.filter((s) => s.id !== step.id),
              })
            }
            type="button"
            variant="ghost"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      ))}
    </section>
  );
}
