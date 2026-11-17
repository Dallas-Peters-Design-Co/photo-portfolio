import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { newItemId } from "../../../config/proposal.js";
import {
  DEFAULT_REVIEW_DOC,
  type ReviewScreen,
} from "../../../config/review.js";
import { mergeAudit } from "../../../config/reviewAudit.js";
import {
  mergeChecks,
  type ReferenceCheck,
} from "../../../config/reviewChecks.js";
import { type ReviewRecord, reviewsApi } from "../../services/reviewService";
import { useConfirm } from "./ConfirmProvider";

export type AuditPhase = "idle" | "capturing" | "exploring" | "auditing";

const HAS_SCHEME = /^https?:\/\//i;
const VIEWPORTS = ["desktop", "mobile"] as const;
/** How often the editor asks the agent how a capture is going. */
const POLL_MS = 5000;
/** A capture still running after this long is given up on. */
const CAPTURE_LIMIT_MS = 45 * 60 * 1000;

/** Pages the sign-in agent captures, each at two widths. */
const AGENT_PAGES = 12;
/** The most the agent takes (api/_lib/reviewAgent.ts MAX_AGENT_PAGES). */
const MAX_AGENT_PAGES = 15;
const TRAILING_HYPHENS = /-+$/;

const two = (n: number) => String(n).padStart(2, "0");

/** A scan's time, for the new review's address and title. */
const scanStamp = (at: Date) => ({
  label: `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())} ${two(at.getHours())}:${two(at.getMinutes())}`,
  slug: `${at.getFullYear()}${two(at.getMonth() + 1)}${two(at.getDate())}-${two(at.getHours())}${two(at.getMinutes())}`,
});

const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));

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
  const navigate = useNavigate();
  const [phase, setPhase] = useState<AuditPhase>("idle");
  // The agent's latest step during a login capture, for the button label.
  const [agentStatus, setAgentStatus] = useState("");
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

  /**
   * The eve audit agent signs in with the stored test account, finds the key
   * pages and screenshots each at desktop and phone width. Its screens join
   * the review, then the audit runs on them as it does on any capture.
   */
  const captureBehindLogin = async (): Promise<{
    checks: ReferenceCheck[];
    screens: ReviewScreen[];
  } | null> => {
    const answer = await prompt({
      confirmLabel: "Capture and audit",
      defaultValue: "https://",
      description: `The agent signs in with the stored test account, explores the app up to ${AGENT_PAGES} pages deep into its sections, and screenshots each at desktop and phone width. It looks but never changes anything. The result is saved as a new review; this one is left as it is. This takes several minutes.`,
      placeholder: "https://app.example.com",
      title: "Which app should the agent sign in to?",
    });
    const typed = answer?.trim() ?? "";
    if (!typed || typed === "https://") {
      return null;
    }
    const url = HAS_SCHEME.test(typed) ? typed : `https://${typed}`;
    const signIn = await prompt({
      confirmLabel: "Start",
      defaultValue: url,
      description:
        "The test account's password is only ever typed on this site. Leave it as the app's address if the app shows its sign-in page there.",
      placeholder: "https://app.example.com/login",
      title: "Where is the sign-in page?",
    });
    const signInTyped = signIn?.trim() ?? "";
    if (!signInTyped) {
      return null;
    }
    const loginUrl = HAS_SCHEME.test(signInTyped)
      ? signInTyped
      : `https://${signInTyped}`;
    const { slug } = latest.current;
    setPhase("exploring");
    setAgentStatus("Starting the browser…");
    const { brief } = latest.current.doc;
    const { session } = await reviewsApi.captureWithLogin({
      brief,
      loginUrl,
      // A brief names areas that must be reached: the agent gets its most.
      pages: brief ? MAX_AGENT_PAGES : AGENT_PAGES,
      slug,
      url,
    });
    const startedAt = Date.now();
    // One check at a time: each waits, asks, and either finishes or schedules
    // the next, so a slow answer never overlaps the one after it.
    const poll = async (): Promise<{
      checks: ReferenceCheck[];
      screens: ReviewScreen[];
    }> => {
      if (Date.now() - startedAt > CAPTURE_LIMIT_MS) {
        throw new Error("The capture took longer than 45 minutes.");
      }
      await wait(POLL_MS);
      const status = await reviewsApi.captureStatus(session, slug);
      if (status.state === "running") {
        setAgentStatus(status.phase);
        return poll();
      }
      if (status.state === "failed") {
        throw new Error(status.error);
      }
      if (status.screens.length === 0) {
        throw new Error(status.note || "The agent captured no screens.");
      }
      return status;
    };
    return poll();
  };

  const auditThese = async (screens: ReviewScreen[]) => {
    setPhase("auditing");
    const { audit } = await reviewsApi.audit({
      brief: latest.current.doc.brief,
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
  };

  const auditScreens = async (
    capture: () => Promise<ReviewScreen[] | null>
  ) => {
    try {
      const screens = await capture();
      if (!screens) {
        return;
      }
      await auditThese(screens);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not run the UX audit"
      );
    } finally {
      setPhase("idle");
      setAgentStatus("");
    }
  };

  const runAudit = async () => {
    const withPictures = latest.current.doc.screens.filter((s) => s.image);
    await auditScreens(async () =>
      withPictures.length > 0 ? withPictures : await captureReferences()
    );
  };

  /**
   * The agent's capture, validated and audited, saved as a new review: the
   * review open in the editor is not touched, so a scan can be run again and
   * compared rather than piling onto the last one. Same client and brand.
   */
  const runLoginAudit = async () => {
    try {
      const captured = await captureBehindLogin();
      if (!captured) {
        return;
      }
      const source = latest.current;
      let doc = mergeChecks(
        // The scan keeps the brief, so it can be audited again against it.
        {
          ...DEFAULT_REVIEW_DOC,
          brief: source.doc.brief,
          screens: captured.screens,
        },
        captured.checks
      );
      setPhase("auditing");
      let audited = true;
      try {
        const { audit } = await reviewsApi.audit({
          brief: source.doc.brief,
          screens: captured.screens,
          title: source.title,
        });
        doc = mergeAudit(doc, audit);
      } catch {
        // The screens and checks are still worth keeping.
        audited = false;
      }
      const stamp = scanStamp(new Date());
      const created = await reviewsApi.create({
        brandKitId: source.brandKitId,
        clientEmail: source.clientEmail,
        clientName: source.clientName,
        doc,
        slug: `${source.slug.slice(0, 40).replace(TRAILING_HYPHENS, "")}-scan-${stamp.slug}`,
        status: "draft",
        title: `${source.title} — app scan ${stamp.label}`.slice(0, 160),
      });
      const open = `/admin/reviews/${encodeURIComponent(created.slug)}`;
      toast.success(
        audited
          ? `New review saved with ${captured.screens.length} screens.`
          : `New review saved with ${captured.screens.length} screens; the audit failed, so run it there.`,
        { action: { label: "Open", onClick: () => navigate(open) } }
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not run the app scan"
      );
    } finally {
      setPhase("idle");
      setAgentStatus("");
    }
  };

  return { agentStatus, auditKey, phase, runAudit, runLoginAudit };
}
