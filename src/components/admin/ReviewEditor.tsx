import { ChevronsDownUp, ChevronsUpDown, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { BrandKitDoc } from "../../../config/brandKit.js";
import { newItemId } from "../../../config/proposal.js";
import type {
  ReviewDoc,
  ReviewScreen,
  RichText,
} from "../../../config/review.js";
import { MAX_REVIEW_CONCEPTS } from "../../../config/review.js";
import { PageEditor } from "../../cms/PageEditor";
import { useBrandKits } from "../../hooks/useBrandKits";
import { downloadReviewPdf } from "../../pages/pagePdf";
import { type ReviewRecord, reviewsApi } from "../../services/reviewService";
import { useSiteSettings } from "../../theme/SiteSettingsProvider";
import { reviewAccentStyle } from "../review/ReviewMarkup";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { EditorBlock, useCollapsedBlocks } from "./EditorBlock";
import { EditorShell } from "./EditorShell";
import { ReviewClientPanel } from "./ReviewClientPanel";
import { ReviewEditorActions, type SaveState } from "./ReviewEditorActions";
import { ReviewEditorPanel } from "./ReviewEditorPanel";
import { ReviewScreenEditor } from "./ReviewScreenEditor";
import { ReviewSectionsEditor } from "./ReviewSectionsEditor";
import { ReviewSendPanel } from "./ReviewSendPanel";
import { toEditorDoc } from "./reviewEditing";
import { SortableList } from "./SortableList";
import { type AuditPhase, useReviewAudit } from "./useReviewAudit";

/** How long typing pauses before the draft saves itself. */
const AUTOSAVE_MS = 1200;

/**
 * What autosave writes: everything but the address and the status. Renaming
 * the address moves the page, and publishing is a decision, so both wait for
 * the Save and Publish buttons.
 */
const autosaveFields = (r: ReviewRecord) => ({
  brandKitId: r.brandKitId,
  clientEmail: r.clientEmail,
  clientName: r.clientName,
  doc: r.doc,
  title: r.title,
});

const AUDIT_LABELS: Record<AuditPhase, string> = {
  auditing: "Auditing… (1–3 min)",
  capturing: "Capturing screens…",
  exploring: "Agent at work…",
  idle: "Run UX audit",
};

const fingerprint = (r: ReviewRecord): string =>
  JSON.stringify(autosaveFields(r));

const fieldsetTitleClass =
  "text-micro-sm uppercase tracking-micro-widest text-white/70";

/**
 * The review editor: a side panel on the left with everything that is not
 * content (saving, settings, the audit, client access, sending), and beside
 * it the content in the order the page shows it — the opening, the sections,
 * the screens, the closing — each folding away, sections and screens dragged
 * into a new order by their handles.
 */
export function ReviewEditor({
  review,
  onClose,
  onSaved,
}: {
  review: ReviewRecord;
  onClose: () => void;
  onSaved: (saved: ReviewRecord) => Promise<void>;
}) {
  const [draft, setDraft] = useState<ReviewRecord>(review);
  const { kits } = useBrandKits();
  const brandDoc: BrandKitDoc | null =
    kits.find((kit) => kit.id === draft.brandKitId)?.resolvedDoc ?? null;
  // Markup and pins are drawn in the site accent, as the client will see them.
  const { settings } = useSiteSettings();
  const [isSaving, setIsSaving] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  // What the server last confirmed, and the draft as it is right now, for
  // the timers and the unmount flush, which outlive the render they start in.
  const savedPrint = useRef(fingerprint(review));
  const latest = useRef(draft);
  latest.current = draft;
  const { agentStatus, auditKey, phase, runAudit, runLoginAudit } =
    useReviewAudit({ latest, setDraft });

  const setDoc = (patch: Partial<ReviewDoc>) =>
    setDraft((d) => ({ ...d, doc: { ...d.doc, ...patch } }));

  /*
   * The draft saves itself a moment after each change, so a capture, a pin
   * or a mark is never only in this tab — and Preview, which opens the saved
   * review, shows what is on screen here.
   */
  const autosave = useCallback(async () => {
    const { current } = latest;
    const print = fingerprint(current);
    if (print === savedPrint.current) {
      return;
    }
    setSaveState("saving");
    try {
      await reviewsApi.update(review.slug, autosaveFields(current));
      savedPrint.current = print;
      setSaveState(fingerprint(latest.current) === print ? "saved" : "unsaved");
    } catch {
      setSaveState("failed");
    }
  }, [review.slug]);

  useEffect(() => {
    if (fingerprint(draft) === savedPrint.current) {
      return;
    }
    setSaveState("unsaved");
    const timer = window.setTimeout(() => void autosave(), AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
  }, [autosave, draft]);

  // Closing the editor mid-pause still keeps the last change.
  useEffect(
    () => () => {
      if (fingerprint(latest.current) !== savedPrint.current) {
        reviewsApi
          .update(review.slug, autosaveFields(latest.current))
          .catch(() => undefined);
      }
    },
    [review.slug]
  );

  const save = async (
    overrides: Partial<ReviewRecord> = {}
  ): Promise<ReviewRecord | null> => {
    setIsSaving(true);
    try {
      const next = { ...draft, ...overrides };
      const saved = await reviewsApi.update(review.slug, {
        brandKitId: next.brandKitId,
        clientEmail: next.clientEmail,
        clientName: next.clientName,
        doc: next.doc,
        slug: next.slug,
        status: next.status,
        title: next.title,
      });
      setDraft(saved);
      savedPrint.current = fingerprint(saved);
      setSaveState("saved");
      await onSaved(saved);
      toast.success(
        saved.status === "published" ? "Published" : "Saved as draft"
      );
      return saved;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save review");
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  // The server prints the saved page, so save first: the PDF is then exactly
  // what is on screen here, draft or published.
  const printPdf = async () => {
    setIsPrinting(true);
    try {
      const saved = await save();
      if (saved) {
        await downloadReviewPdf(saved.slug);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not make the PDF"
      );
    } finally {
      setIsPrinting(false);
    }
  };

  // Applied to the screen as it is when the change lands, not as it was when
  // the change began: a capture returns long after it was asked for.
  const updateScreen = (
    id: string,
    update: (prev: ReviewScreen) => ReviewScreen
  ) =>
    setDraft((d) => ({
      ...d,
      doc: {
        ...d.doc,
        screens: d.doc.screens.map((s) => (s.id === id ? update(s) : s)),
      },
    }));

  // Preview opens the saved review, so anything not yet saved goes first.
  const openPreview = async () => {
    const pending =
      fingerprint(draft) !== savedPrint.current || draft.slug !== review.slug;
    const saved = pending ? await save() : draft;
    if (saved) {
      window.open(`/review/${saved.slug}`, "_blank", "noopener");
    }
  };

  // The number the first pin on each screen carries, so numbering runs on
  // across screens the way the page shows it.
  const firstNumbers: number[] = [];
  let n = 1;
  for (const screen of draft.doc.screens) {
    firstNumbers.push(n);
    n += screen.pins.length;
  }

  const collapse = useCollapsedBlocks(`review-editor-folded:${review.id}`);
  const blockIds = [
    "opening",
    ...draft.doc.sections.map((x) => x.id),
    ...draft.doc.screens.map((x) => x.id),
    "closing",
  ];
  const allFolded = blockIds.every((id) => collapse.isCollapsed(id));

  const addScreen = () =>
    setDoc({
      screens: [
        ...draft.doc.screens,
        {
          id: newItemId(),
          image: null,
          marks: [],
          note: "",
          pins: [],
          sourceUrl: "",
          title: "",
          viewport: "desktop",
        },
      ],
    });

  const reorderScreens = (ids: string[]) =>
    setDraft((d) => ({
      ...d,
      doc: {
        ...d.doc,
        screens: ids.flatMap(
          (id) => d.doc.screens.find((s) => s.id === id) ?? []
        ),
      },
    }));

  return (
    <EditorShell
      backLabel="Reviews"
      label="Review settings"
      onBack={onClose}
      panel={
        <ReviewEditorPanel
          actions={
            <ReviewEditorActions
              draft={draft}
              isPrinting={isPrinting}
              isSaving={isSaving}
              latest={latest}
              onLinkBoard={(boardId) => setDoc({ boardId })}
              onPreview={() => void openPreview()}
              onPrint={() => void printPdf()}
              onSave={(overrides) => void save(overrides)}
              saveState={saveState}
            />
          }
          audit={{
            label: AUDIT_LABELS[phase],
            loginLabel:
              phase === "exploring"
                ? agentStatus || AUDIT_LABELS.exploring
                : "Capture behind login",
            onAudit: () => void runAudit(),
            onLoginAudit: () => void runLoginAudit(),
            running: phase !== "idle",
          }}
          clientAccess={
            <ReviewClientPanel
              onChange={(next) => setDraft((d) => ({ ...d, ...next }))}
              review={draft}
            />
          }
          draft={draft}
          send={
            <ReviewSendPanel
              busy={isSaving}
              onChange={(next) => {
                setDraft((d) => ({ ...d, sent: next.sent }));
                void onSaved(next);
              }}
              review={draft}
            />
          }
          setDraft={setDraft}
        />
      }
      storageKey="review-editor-panel-open"
      style={reviewAccentStyle(settings.theme)}
    >
      <div className="space-y-8">
        <div className="flex items-center justify-end">
          <Button
            onClick={() => collapse.setAll(blockIds, !allFolded)}
            type="button"
            variant="ghost"
          >
            {allFolded ? (
              <ChevronsUpDown size={14} />
            ) : (
              <ChevronsDownUp size={14} />
            )}
            {allFolded ? "Expand all" : "Collapse all"}
          </Button>
        </div>

        <EditorBlock
          collapsed={collapse.isCollapsed("opening")}
          onToggle={() => collapse.toggle("opening")}
          title="Opening"
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Intro</Label>
              <PageEditor
                onChange={(intro) => setDoc({ intro: intro as RichText })}
                value={toEditorDoc(draft.doc.intro)}
              />
            </div>
            <div className="space-y-2">
              <Label>Headline findings</Label>
              <PageEditor
                key={auditKey}
                onChange={(summary) => setDoc({ summary: summary as RichText })}
                value={toEditorDoc(draft.doc.summary)}
              />
            </div>
          </div>
        </EditorBlock>

        <ReviewSectionsEditor
          collapse={collapse}
          onChange={(update) =>
            setDraft((d) => ({
              ...d,
              doc: { ...d.doc, sections: update(d.doc.sections) },
            }))
          }
          sections={draft.doc.sections}
        />

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className={fieldsetTitleClass}>Screens</h3>
            <Button onClick={addScreen} type="button" variant="ghost">
              <Plus size={14} /> Add screen
            </Button>
          </div>
          <SortableList
            itemLabel={(s) => s.title || "screen"}
            items={draft.doc.screens}
            onReorder={reorderScreens}
          >
            {(screen, { compact, handle }) => (
              <EditorBlock
                collapsed={compact || collapse.isCollapsed(screen.id)}
                handle={handle}
                onToggle={() => collapse.toggle(screen.id)}
                title={screen.title || "Untitled screen"}
              >
                <ReviewScreenEditor
                  brandDoc={brandDoc}
                  conceptLimit={
                    MAX_REVIEW_CONCEPTS -
                    draft.doc.concepts.length -
                    draft.doc.screens
                      .filter((other) => other.id !== screen.id)
                      .reduce(
                        (total, other) =>
                          total +
                          other.pins.reduce(
                            (count, pin) => count + (pin.concepts?.length ?? 0),
                            0
                          ),
                        0
                      )
                  }
                  firstNumber={
                    firstNumbers[draft.doc.screens.indexOf(screen)] ?? 1
                  }
                  onChange={(update) => updateScreen(screen.id, update)}
                  onRemove={() =>
                    setDraft((d) => ({
                      ...d,
                      doc: {
                        ...d.doc,
                        screens: d.doc.screens.filter(
                          (s) => s.id !== screen.id
                        ),
                      },
                    }))
                  }
                  screen={screen}
                  slug={draft.slug}
                />
              </EditorBlock>
            )}
          </SortableList>
        </section>

        <EditorBlock
          collapsed={collapse.isCollapsed("closing")}
          onToggle={() => collapse.toggle("closing")}
          title="Closing"
        >
          <PageEditor
            onChange={(closing) => setDoc({ closing: closing as RichText })}
            value={toEditorDoc(draft.doc.closing)}
          />
        </EditorBlock>
      </div>
    </EditorShell>
  );
}
