import { HugeiconsIcon } from "@hugeicons/react";
import EyeIcon from "@hugeicons-pro/core-stroke-standard/EyeIcon";
import FloppyDiskIcon from "@hugeicons-pro/core-stroke-standard/FloppyDiskIcon";
import SearchVisualIcon from "@hugeicons-pro/core-stroke-standard/SearchVisualIcon";
import ViewOffIcon from "@hugeicons-pro/core-stroke-standard/ViewOffIcon";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { newItemId } from "../../../config/proposal.js";
import type {
  ReviewDoc,
  ReviewScreen,
  RichText,
} from "../../../config/review.js";
import { PageEditor } from "../../cms/PageEditor";
import { useBrandKits } from "../../hooks/useBrandKits";
import { downloadReviewPdf } from "../../pages/pagePdf";
import { type ReviewRecord, reviewsApi } from "../../services/reviewService";
import { useSiteSettings } from "../../theme/SiteSettingsProvider";
import { reviewAccentStyle } from "../review/ReviewMarkup";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { proposalInputClass, proposalLabelClass } from "./proposalStyles";
import { ReviewScreenEditor } from "./ReviewScreenEditor";
import { ReviewSendPanel } from "./ReviewSendPanel";

const PARAGRAPH_BREAK = /\n\s*\n/;

const toEditorDoc = (value: RichText): unknown => {
  if (typeof value !== "string") {
    return value;
  }
  return {
    content: value
      .split(PARAGRAPH_BREAK)
      .map((t) => t.trim())
      .map((text) =>
        text
          ? { content: [{ text, type: "text" }], type: "paragraph" }
          : { type: "paragraph" }
      ),
    type: "doc",
  };
};

const fieldsetTitleClass =
  "text-[11px] uppercase tracking-[0.2em] text-white/70";

/**
 * The review editor: who it is for, the opening, then the screens in the
 * order the page shows them, each with its picture and pins.
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
  // Markup and pins are drawn in the site accent, as the client will see them.
  const { settings } = useSiteSettings();
  const [isSaving, setIsSaving] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const { kits } = useBrandKits();

  const setDoc = (patch: Partial<ReviewDoc>) =>
    setDraft((d) => ({ ...d, doc: { ...d.doc, ...patch } }));

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

  const updateScreen = (id: string, next: ReviewScreen) =>
    setDoc({ screens: draft.doc.screens.map((s) => (s.id === id ? next : s)) });

  // The number the first pin on each screen carries, so numbering runs on
  // across screens the way the page shows it.
  const firstNumbers: number[] = [];
  let n = 1;
  for (const screen of draft.doc.screens) {
    firstNumbers.push(n);
    n += screen.pins.length;
  }

  const isPublished = draft.status === "published";

  return (
    <Card
      className="w-full max-w-7xl border-white/10 bg-white/2"
      style={reviewAccentStyle(settings.theme.accent)}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="flex items-center gap-2 font-light text-sm text-white/90 uppercase tracking-[0.2em]">
          <HugeiconsIcon aria-hidden icon={SearchVisualIcon} size={16} />
          {draft.title}
        </CardTitle>
        <Button onClick={onClose} type="button" variant="ghost">
          <X className="mr-1.5" size={14} />
          Close
        </Button>
      </CardHeader>

      <CardContent className="space-y-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-2">
            <Label className={proposalLabelClass} htmlFor="review-title">
              Title
            </Label>
            <Input
              className={proposalInputClass}
              id="review-title"
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              value={draft.title}
            />
          </div>
          <div className="space-y-2">
            <Label className={proposalLabelClass} htmlFor="review-client">
              Client label
            </Label>
            <Input
              className={proposalInputClass}
              id="review-client"
              onChange={(e) =>
                setDraft({ ...draft, clientName: e.target.value })
              }
              placeholder="Vin at Viaskai"
              value={draft.clientName}
            />
          </div>
          <div className="space-y-2">
            <Label className={proposalLabelClass} htmlFor="review-email">
              Client email
            </Label>
            <Input
              className={proposalInputClass}
              id="review-email"
              onChange={(e) =>
                setDraft({ ...draft, clientEmail: e.target.value || null })
              }
              placeholder="Gets the link"
              type="email"
              value={draft.clientEmail ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label className={proposalLabelClass} htmlFor="review-kit">
              Brand kit
            </Label>
            <select
              className={`${proposalInputClass} w-full rounded-md border px-3`}
              id="review-kit"
              onChange={(e) =>
                setDraft({ ...draft, brandKitId: e.target.value || null })
              }
              value={draft.brandKitId ?? ""}
            >
              <option value="">None (site accent)</option>
              {kits.map((kit) => (
                <option key={kit.id} value={kit.id}>
                  {kit.parentName
                    ? `${kit.parentName} / ${kit.name}`
                    : kit.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label className={proposalLabelClass} htmlFor="review-slug">
              Address
            </Label>
            <Input
              className={`${proposalInputClass} font-mono`}
              id="review-slug"
              onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
              value={draft.slug}
            />
            <p className="font-mono text-[10px] text-white/60">
              /review/{draft.slug}
            </p>
          </div>
        </div>

        <section className="space-y-4">
          <h3 className={fieldsetTitleClass}>Opening</h3>
          <div className="space-y-2">
            <Label className={proposalLabelClass}>Intro</Label>
            <PageEditor
              onChange={(intro) => setDoc({ intro: intro as RichText })}
              value={toEditorDoc(draft.doc.intro)}
            />
          </div>
          <div className="space-y-2">
            <Label className={proposalLabelClass}>Headline findings</Label>
            <PageEditor
              onChange={(summary) => setDoc({ summary: summary as RichText })}
              value={toEditorDoc(draft.doc.summary)}
            />
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className={fieldsetTitleClass}>Screens</h3>
            <Button
              onClick={() =>
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
                })
              }
              type="button"
              variant="ghost"
            >
              <Plus size={14} /> Add screen
            </Button>
          </div>
          {draft.doc.screens.map((screen, i) => (
            <ReviewScreenEditor
              firstNumber={firstNumbers[i] ?? 1}
              key={screen.id}
              onChange={(next) => updateScreen(screen.id, next)}
              onRemove={() =>
                setDoc({
                  screens: draft.doc.screens.filter((s) => s.id !== screen.id),
                })
              }
              screen={screen}
              slug={draft.slug}
            />
          ))}
        </section>

        <section className="space-y-2">
          <Label className={proposalLabelClass}>Closing</Label>
          <PageEditor
            onChange={(closing) => setDoc({ closing: closing as RichText })}
            value={toEditorDoc(draft.doc.closing)}
          />
        </section>

        <ReviewSendPanel
          busy={isSaving}
          onChange={(next) => {
            setDraft((d) => ({ ...d, sent: next.sent }));
            void onSaved(next);
          }}
          review={draft}
        />

        <div className="flex flex-wrap items-center gap-3">
          <Button
            disabled={isSaving}
            onClick={() => void save()}
            type="button"
            variant="outline"
          >
            <HugeiconsIcon icon={FloppyDiskIcon} size={14} />
            {isSaving ? "Saving…" : "Save"}
          </Button>
          <Button
            disabled={isSaving}
            onClick={() =>
              void save({ status: isPublished ? "draft" : "published" })
            }
            type="button"
            variant="ghost"
          >
            <HugeiconsIcon
              icon={isPublished ? EyeIcon : ViewOffIcon}
              size={14}
            />
            {isPublished ? "Unpublish" : "Publish"}
          </Button>
          <span
            className={`text-[10px] uppercase tracking-[0.16em] ${
              isPublished ? "text-emerald-400/70" : "text-amber-400/70"
            }`}
          >
            {draft.status}
          </span>
          <a
            className="ml-auto text-[10px] text-white/90 uppercase tracking-[0.16em] transition-colors hover:text-white"
            href={`/review/${draft.slug}`}
            rel="noreferrer"
            target="_blank"
          >
            Preview
          </a>
          <button
            className="text-[10px] text-white/90 uppercase tracking-[0.16em] transition-colors hover:text-white disabled:cursor-progress disabled:text-white/50"
            disabled={isPrinting || isSaving}
            onClick={() => void printPdf()}
            type="button"
          >
            {isPrinting ? "Preparing PDF…" : "PDF"}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
