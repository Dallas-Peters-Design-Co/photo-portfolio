import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useState,
} from "react";
import { toast } from "sonner";
import { newItemId } from "../../../config/proposal.js";
import type { ReviewScreen } from "../../../config/review.js";
import { mergeAudit } from "../../../config/reviewAudit.js";
import { type ReviewRecord, reviewsApi } from "../../services/reviewService";
import { useConfirm } from "./ConfirmProvider";

export type AuditPhase = "idle" | "capturing" | "auditing";

const HAS_SCHEME = /^https?:\/\//i;
const VIEWPORTS = ["desktop", "mobile"] as const;

const hostOf = (url: string): string => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

/**
 * Running a UX audit from the review editor.
 *
 * The audit reads the screens that have pictures. A review with none yet
 * asks for an address and captures it at desktop and phone width first, so
 * the audit always arrives with reference screenshots to pin and mark up.
 *
 * Every write goes through `setDraft` with the draft as it is when the reply
 * lands: an audit takes minutes, and edits made meanwhile are kept.
 */
export function useReviewAudit({
  latest,
  setDraft,
}: {
  latest: RefObject<ReviewRecord>;
  setDraft: Dispatch<SetStateAction<ReviewRecord>>;
}) {
  const { prompt } = useConfirm();
  const [phase, setPhase] = useState<AuditPhase>("idle");
  // Bumped after an audit so the summary editor, which reads its value only
  // when it mounts, opens again on the merged text.
  const [auditKey, setAuditKey] = useState(0);

  const captureReferences = async (): Promise<ReviewScreen[] | null> => {
    const answer = await prompt({
      confirmLabel: "Capture and audit",
      defaultValue:
        latest.current.doc.screens.find((s) => s.sourceUrl)?.sourceUrl ??
        "https://",
      placeholder: "https://example.com",
      title: "Which page should the audit capture?",
    });
    const typed = answer?.trim() ?? "";
    if (!typed || typed === "https://") {
      return null;
    }
    const url = HAS_SCHEME.test(typed) ? typed : `https://${typed}`;
    setPhase("capturing");
    const { slug } = latest.current;
    const shots = await Promise.all(
      VIEWPORTS.map(async (viewport): Promise<ReviewScreen> => {
        const { image } = await reviewsApi.capture({ slug, url, viewport });
        return {
          id: newItemId(),
          image,
          marks: [],
          note: "",
          pins: [],
          sourceUrl: url,
          title: `${hostOf(url)} — ${viewport}`,
          viewport,
        };
      })
    );
    setDraft((d) => ({
      ...d,
      doc: { ...d.doc, screens: [...d.doc.screens, ...shots] },
    }));
    return shots;
  };

  const runAudit = async () => {
    try {
      let screens = latest.current.doc.screens.filter((s) => s.image);
      if (screens.length === 0) {
        const shots = await captureReferences();
        if (!shots) {
          return;
        }
        screens = shots;
      }
      setPhase("auditing");
      const { audit } = await reviewsApi.audit({
        screens,
        title: latest.current.title,
      });
      setDraft((d) => ({ ...d, doc: mergeAudit(d.doc, audit) }));
      setAuditKey((k) => k + 1);
      const placed = audit.findings.filter((f) => f.screenId !== null).length;
      toast.success(
        placed > 0
          ? `Audit added (${placed} ${placed === 1 ? "pin" : "pins"} placed)`
          : "Audit added to review"
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not run the UX audit"
      );
    } finally {
      setPhase("idle");
    }
  };

  return { auditKey, phase, runAudit };
}
