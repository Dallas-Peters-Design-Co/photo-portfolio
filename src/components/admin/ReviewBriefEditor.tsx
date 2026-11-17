import { ScanSearch } from "lucide-react";
import type {
  BriefCoverage,
  CoverageStatus,
} from "../../../config/reviewBrief.js";
import { MAX_BRIEF } from "../../../config/reviewBrief.js";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { EditorBlock } from "./EditorBlock";
import { proposalTextareaClass } from "./proposalStyles";

/**
 * The review's brief: the client's meeting notes or scope, pasted as
 * written. The sign-in capture visits what it names first and the audit
 * works to it, then lists each item it asks for as covered or not. Only
 * the designer sees either; the client's copy leaves them out.
 */

const STATUS_LABEL: Record<CoverageStatus, string> = {
  covered: "Covered",
  missing: "Missing",
  partial: "Partly",
};

const STATUS_CLASS: Record<CoverageStatus, string> = {
  covered: "text-emerald-300",
  missing: "text-red-300",
  partial: "text-amber-300",
};

interface GapCapture {
  label: string;
  onCapture: () => void;
  running: boolean;
}

function CoverageList({
  coverage,
  gaps,
}: {
  coverage: BriefCoverage[];
  gaps: GapCapture;
}) {
  const open = coverage.filter((c) => c.status !== "covered").length;
  return (
    <div className="space-y-2">
      <Label>
        Brief coverage —{" "}
        {open === 0 ? "everything covered" : `${open} still to cover`}
      </Label>
      {open > 0 ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            disabled={gaps.running}
            onClick={gaps.onCapture}
            title="Send the sign-in agent for the open items only, add its screens to this review, and run the audit again"
            type="button"
            variant="outline"
          >
            <ScanSearch size={14} />
            {gaps.running ? gaps.label : `Capture the ${open} open items`}
          </Button>
          <span className="text-sm text-white/55">
            The agent goes back for these screens, then the audit runs again.
          </span>
        </div>
      ) : null}
      <ul className="space-y-2 text-sm">
        {coverage.map((c) => (
          <li className="flex gap-3" key={c.item}>
            <span
              className={`w-16 shrink-0 font-medium ${STATUS_CLASS[c.status]}`}
            >
              {STATUS_LABEL[c.status]}
            </span>
            <span>
              <span className="text-white/90">{c.item}</span>
              {c.where ? (
                <span className="block text-white/55">{c.where}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ReviewBriefEditor({
  brief,
  collapsed,
  coverage,
  gapsLabel,
  onCaptureGaps,
  onChange,
  onToggle,
  running,
}: {
  brief: string;
  collapsed: boolean;
  coverage: BriefCoverage[];
  gapsLabel: string;
  onCaptureGaps: () => void;
  onChange: (brief: string) => void;
  onToggle: () => void;
  running: boolean;
}) {
  return (
    <EditorBlock collapsed={collapsed} onToggle={onToggle} title="Brief">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="review-brief">What the client asked for</Label>
          <textarea
            className={`${proposalTextareaClass} min-h-40`}
            id="review-brief"
            maxLength={MAX_BRIEF}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Paste the meeting notes, email or scope. The capture visits every area it names first, and the audit covers each thing it asks for."
            value={brief}
          />
          <p className="text-sm text-white/55">
            Only you see this. The client's copy of the review leaves it out.
          </p>
        </div>
        {coverage.length > 0 ? (
          <CoverageList
            coverage={coverage}
            gaps={{ label: gapsLabel, onCapture: onCaptureGaps, running }}
          />
        ) : null}
      </div>
    </EditorBlock>
  );
}
