import { HugeiconsIcon } from "@hugeicons/react";
import EyeIcon from "@hugeicons-pro/core-stroke-standard/EyeIcon";
import FloppyDiskIcon from "@hugeicons-pro/core-stroke-standard/FloppyDiskIcon";
import Invoice03Icon from "@hugeicons-pro/core-stroke-standard/Invoice03Icon";
import ViewOffIcon from "@hugeicons-pro/core-stroke-standard/ViewOffIcon";
import { Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  newItemId,
  type ProposalDoc,
  type ProposalSection,
  type ProposalStep,
  type RichText,
} from "../../../config/proposal.js";
import { PageEditor } from "../../cms/PageEditor";
import { useBrandKits } from "../../hooks/useBrandKits";
import {
  type ProposalRecord,
  proposalsApi,
} from "../../services/proposalService";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { ProposalActivity } from "./ProposalActivity";
import { ProposalInvoices } from "./ProposalInvoices";
import { ProposalPackagesEditor } from "./ProposalPackagesEditor";
import { ProposalSendPanel } from "./ProposalSendPanel";
import {
  proposalInputClass,
  proposalLabelClass,
  proposalTextareaClass,
} from "./proposalStyles";

/**
 * The editor takes a TipTap document. Text written before the editor (seeded
 * proposals, the defaults) is a string; it opens as one paragraph per blank
 * line, and is saved back as a document from then on.
 */
const PARAGRAPH_BREAK = /\n\s*\n/;

const toEditorDoc = (value: RichText): unknown => {
  if (typeof value !== "string") {
    return value;
  }
  const paragraphs = value.split(PARAGRAPH_BREAK).map((t) => t.trim());
  return {
    content: paragraphs.map((text) =>
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
 * The proposal editor: the fields that name it, then each part of the document
 * in the order the page shows them.
 *
 * Everything is plain text. Section bodies accept blank lines for paragraphs
 * and "- " for bullets, which covers what a proposal needs without dragging a
 * rich-text editor into a form that already has twenty inputs.
 */
export function ProposalEditor({
  proposal,
  onClose,
  onSaved,
}: {
  proposal: ProposalRecord;
  onClose: () => void;
  onSaved: (saved: ProposalRecord) => Promise<void>;
}) {
  const [draft, setDraft] = useState<ProposalRecord>(proposal);
  const [isSaving, setIsSaving] = useState(false);
  // Bumped after a send or an invoice action, so the timeline re-reads.
  const [activityKey, setActivityKey] = useState(0);
  const { kits } = useBrandKits();

  const setDoc = (patch: Partial<ProposalDoc>) =>
    setDraft((d) => ({ ...d, doc: { ...d.doc, ...patch } }));

  const save = async (overrides: Partial<ProposalRecord> = {}) => {
    setIsSaving(true);
    try {
      const next = { ...draft, ...overrides };
      const saved = await proposalsApi.update(proposal.slug, {
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
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not save proposal"
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Clears the signature so the proposal can be sent again, or the flow
  // tested again. Saves nothing else, so unsaved edits stay in the form.
  const resetAcceptance = async () => {
    setIsSaving(true);
    try {
      const saved = await proposalsApi.update(proposal.slug, {
        acceptance: null,
      });
      setDraft((d) => ({ ...d, acceptance: saved.acceptance }));
      await onSaved(saved);
      toast.success("Acceptance cleared");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reset");
    } finally {
      setIsSaving(false);
    }
  };

  const updateSection = (id: string, patch: Partial<ProposalSection>) =>
    setDoc({
      sections: draft.doc.sections.map((s) =>
        s.id === id ? { ...s, ...patch } : s
      ),
    });

  const updateStep = (id: string, patch: Partial<ProposalStep>) =>
    setDoc({
      process: draft.doc.process.map((s) =>
        s.id === id ? { ...s, ...patch } : s
      ),
    });

  const isPublished = draft.status === "published";

  return (
    <Card className="w-full max-w-7xl border-white/10 bg-white/2">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="flex items-center gap-2 font-light text-sm text-white/90 uppercase tracking-[0.2em]">
          <HugeiconsIcon aria-hidden icon={Invoice03Icon} size={16} />
          {draft.title}
        </CardTitle>
        <Button onClick={onClose} type="button" variant="ghost">
          <X className="mr-1.5" size={14} />
          Close
        </Button>
      </CardHeader>

      <CardContent className="space-y-10">
        {/* Who it is for, and where it lives. */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-2">
            <Label className={proposalLabelClass} htmlFor="proposal-title">
              Title
            </Label>
            <Input
              className={proposalInputClass}
              id="proposal-title"
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              value={draft.title}
            />
          </div>
          <div className="space-y-2">
            <Label className={proposalLabelClass} htmlFor="proposal-client">
              Client label
            </Label>
            <Input
              className={proposalInputClass}
              id="proposal-client"
              onChange={(e) =>
                setDraft({ ...draft, clientName: e.target.value })
              }
              placeholder="Vin at Viaskai"
              value={draft.clientName}
            />
          </div>
          <div className="space-y-2">
            <Label className={proposalLabelClass} htmlFor="proposal-email">
              Client email
            </Label>
            <Input
              className={proposalInputClass}
              id="proposal-email"
              onChange={(e) =>
                setDraft({ ...draft, clientEmail: e.target.value || null })
              }
              placeholder="Gets the signed copy"
              type="email"
              value={draft.clientEmail ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label className={proposalLabelClass} htmlFor="proposal-kit">
              Brand kit
            </Label>
            <select
              className={`${proposalInputClass} w-full rounded-md border px-3`}
              id="proposal-kit"
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
            <Label className={proposalLabelClass} htmlFor="proposal-slug">
              Address
            </Label>
            <Input
              className={`${proposalInputClass} font-mono`}
              id="proposal-slug"
              onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
              value={draft.slug}
            />
            <p className="font-mono text-[10px] text-white/60">
              /proposal/{draft.slug}
            </p>
          </div>
        </div>

        {/* Opening */}
        <section className="space-y-4">
          <h3 className={fieldsetTitleClass}>Opening</h3>
          <div className="space-y-2">
            <Label className={proposalLabelClass} htmlFor="proposal-intro">
              Intro
            </Label>
            <PageEditor
              onChange={(intro) => setDoc({ intro: intro as RichText })}
              value={toEditorDoc(draft.doc.intro)}
            />
          </div>
          <div className="space-y-2">
            <Label className={proposalLabelClass} htmlFor="proposal-summary">
              What you asked for
            </Label>
            <PageEditor
              onChange={(summary) => setDoc({ summary: summary as RichText })}
              value={toEditorDoc(draft.doc.summary)}
            />
          </div>
        </section>

        {/* Prose sections */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className={fieldsetTitleClass}>Sections</h3>
            <Button
              onClick={() =>
                setDoc({
                  sections: [
                    ...draft.doc.sections,
                    { body: "", heading: "", id: newItemId() },
                  ],
                })
              }
              type="button"
              variant="ghost"
            >
              <Plus size={14} /> Add section
            </Button>
          </div>
          {draft.doc.sections.map((section, index) => (
            <div
              className="space-y-2 rounded-md border border-white/10 p-4"
              key={section.id}
            >
              <div className="flex items-end gap-3">
                <div className="flex-1 space-y-2">
                  <Label
                    className={proposalLabelClass}
                    htmlFor={`section-heading-${section.id}`}
                  >
                    Heading {index + 1}
                  </Label>
                  <Input
                    className={proposalInputClass}
                    id={`section-heading-${section.id}`}
                    onChange={(e) =>
                      updateSection(section.id, { heading: e.target.value })
                    }
                    value={section.heading}
                  />
                </div>
                <Button
                  aria-label="Remove section"
                  onClick={() =>
                    setDoc({
                      sections: draft.doc.sections.filter(
                        (s) => s.id !== section.id
                      ),
                    })
                  }
                  type="button"
                  variant="ghost"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
              <PageEditor
                onChange={(body) =>
                  updateSection(section.id, { body: body as RichText })
                }
                value={toEditorDoc(section.body)}
              />
            </div>
          ))}
        </section>

        <ProposalPackagesEditor doc={draft.doc} onChange={setDoc} />

        {/* Process */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className={fieldsetTitleClass}>What happens next</h3>
            <Button
              onClick={() =>
                setDoc({
                  process: [
                    ...draft.doc.process,
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
          {draft.doc.process.map((step, index) => (
            <div
              className="grid gap-3 rounded-md border border-white/10 p-4 sm:grid-cols-[1fr_2fr_auto]"
              key={step.id}
            >
              <Input
                aria-label={`Step ${index + 1} title`}
                className={proposalInputClass}
                onChange={(e) => updateStep(step.id, { title: e.target.value })}
                placeholder={`Step ${index + 1}`}
                value={step.title}
              />
              <textarea
                aria-label={`Step ${index + 1} detail`}
                className={`${proposalTextareaClass} min-h-11`}
                onChange={(e) => updateStep(step.id, { body: e.target.value })}
                value={step.body}
              />
              <Button
                aria-label="Remove step"
                onClick={() =>
                  setDoc({
                    process: draft.doc.process.filter((s) => s.id !== step.id),
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

        {/* Terms and closing */}
        <section className="space-y-4">
          <h3 className={fieldsetTitleClass}>Terms and closing</h3>
          <div className="space-y-2">
            <Label className={proposalLabelClass} htmlFor="proposal-terms">
              Terms (one per line)
            </Label>
            <textarea
              className={proposalTextareaClass}
              id="proposal-terms"
              onChange={(e) => setDoc({ terms: e.target.value.split("\n") })}
              value={draft.doc.terms.join("\n")}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <div className="space-y-2">
              <Label className={proposalLabelClass} htmlFor="proposal-closing">
                Closing line
              </Label>
              <PageEditor
                onChange={(closing) => setDoc({ closing: closing as RichText })}
                value={toEditorDoc(draft.doc.closing)}
              />
            </div>
            <div className="space-y-2">
              <Label className={proposalLabelClass} htmlFor="proposal-valid">
                Valid until (optional)
              </Label>
              <Input
                className={proposalInputClass}
                id="proposal-valid"
                onChange={(e) => setDoc({ validUntil: e.target.value })}
                type="date"
                value={draft.doc.validUntil}
              />
            </div>
          </div>
        </section>

        <ProposalSendPanel
          busy={isSaving}
          onChange={(next) => {
            setDraft((d) => ({ ...d, sent: next.sent }));
            setActivityKey((k) => k + 1);
            void onSaved(next);
          }}
          onReset={() => void resetAcceptance()}
          proposal={draft}
        />
        <ProposalInvoices
          onActivity={() => setActivityKey((k) => k + 1)}
          proposal={draft}
        />
        <ProposalActivity proposalId={draft.id} refreshKey={activityKey} />

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
            {isPublished ? (
              <HugeiconsIcon icon={EyeIcon} size={14} />
            ) : (
              <HugeiconsIcon icon={ViewOffIcon} size={14} />
            )}
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
            href={`/proposal/${draft.slug}`}
            rel="noreferrer"
            target="_blank"
          >
            Preview
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
