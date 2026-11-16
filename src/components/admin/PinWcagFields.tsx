import { X } from "lucide-react";
import type { PinWcag } from "../../../config/review.js";
import {
  WCAG_CRITERIA,
  wcagCriterion,
  wcagLabel,
  wcagUrl,
} from "../../../config/wcag.js";
import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { proposalLabelClass } from "./proposalStyles";

const ITEMS = WCAG_CRITERIA.map((criterion) => ({
  label: wcagLabel(criterion),
  value: criterion.number,
}));

/**
 * An accessibility note's WCAG criteria: the ones it fails, each linked to
 * the W3C's page on meeting it, and a menu to add another. A note made by
 * the accessibility scan arrives with its criteria already set.
 */
export function PinWcagFields({
  label,
  onChange,
  wcag,
}: {
  /** Names the note, for the controls' labels: "Note 3". */
  label: string;
  onChange: (next: PinWcag) => void;
  wcag?: PinWcag;
}) {
  const criteria = wcag?.criteria ?? [];
  const set = (next: string[]) => onChange({ ...wcag, criteria: next });
  return (
    <div className="space-y-1">
      <p className={proposalLabelClass}>Fails WCAG</p>
      {criteria.length > 0 ? (
        <ul className="space-y-1">
          {criteria.map((number) => {
            const criterion = wcagCriterion(number);
            if (!criterion) {
              return null;
            }
            return (
              <li className="flex items-center gap-2 text-sm" key={number}>
                <a
                  className="underline underline-offset-2"
                  href={wcagUrl(criterion)}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {wcagLabel(criterion)}
                </a>
                <Button
                  aria-label={`Remove WCAG ${number} from ${label}`}
                  onClick={() => set(criteria.filter((n) => n !== number))}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <X size={13} />
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <Select
        items={ITEMS}
        onValueChange={(value) => {
          if (typeof value === "string" && !criteria.includes(value)) {
            set([...criteria, value]);
          }
        }}
        value={null}
      >
        <SelectTrigger
          aria-label={`Add a WCAG criterion to ${label}`}
          size="lg"
        >
          <SelectValue placeholder="+ Add a WCAG criterion" />
        </SelectTrigger>
        <SelectContent>
          {ITEMS.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {wcag?.ruleUrl ? (
        <p className="text-sm">
          Found by the scan:{" "}
          <a
            className="underline underline-offset-2"
            href={wcag.ruleUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            {wcag.rule ?? "rule"}
          </a>
        </p>
      ) : null}
    </div>
  );
}
