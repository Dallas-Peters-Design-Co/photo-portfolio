import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { newItemId } from "../../../config/proposal.js";
import type { ReviewSection, RichText } from "../../../config/review.js";
import { PageEditor } from "../../cms/PageEditor";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { proposalInputClass } from "./proposalStyles";
import { toEditorDoc } from "./reviewEditing";

const fieldsetTitleClass =
  "text-micro-sm uppercase tracking-micro-widest text-white/70";

/**
 * The titled passages between the headline findings and the screens.
 *
 * Each is a title and its own editor, in the order the page reads them. An
 * audit writes several at once; they are ordinary sections from then on.
 */
export function ReviewSectionsEditor({
  sections,
  onChange,
}: {
  sections: ReviewSection[];
  /** Given the sections as they are when the change lands, never a copy
   * from an earlier render: a rich editor keeps the handler it started with. */
  onChange: (update: (prev: ReviewSection[]) => ReviewSection[]) => void;
}) {
  const update = (id: string, patch: Partial<ReviewSection>) =>
    onChange((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const move = (id: string, by: -1 | 1) =>
    onChange((prev) => {
      const index = prev.findIndex((s) => s.id === id);
      const target = index + by;
      const moved = prev[index];
      if (!moved || target < 0 || target >= prev.length) {
        return prev;
      }
      const next = prev.filter((s) => s.id !== id);
      next.splice(target, 0, moved);
      return next;
    });

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className={fieldsetTitleClass}>Sections</h3>
        <Button
          onClick={() =>
            onChange((prev) => [
              ...prev,
              { body: "", id: newItemId(), title: "" },
            ])
          }
          type="button"
          variant="ghost"
        >
          <Plus size={14} /> Add section
        </Button>
      </div>
      {sections.map((section, i) => (
        <div className="space-y-2" key={section.id}>
          <div className="flex items-center gap-1">
            <Input
              aria-label="Section title"
              className={proposalInputClass}
              onChange={(e) => update(section.id, { title: e.target.value })}
              placeholder="Section title"
              value={section.title}
            />
            <Button
              aria-label="Move section up"
              disabled={i === 0}
              onClick={() => move(section.id, -1)}
              size="icon"
              type="button"
              variant="ghost"
            >
              <ArrowUp size={14} />
            </Button>
            <Button
              aria-label="Move section down"
              disabled={i === sections.length - 1}
              onClick={() => move(section.id, 1)}
              size="icon"
              type="button"
              variant="ghost"
            >
              <ArrowDown size={14} />
            </Button>
            <Button
              aria-label="Remove section"
              onClick={() =>
                onChange((prev) => prev.filter((s) => s.id !== section.id))
              }
              size="icon"
              type="button"
              variant="ghost"
            >
              <X size={14} />
            </Button>
          </div>
          <PageEditor
            onChange={(body) => update(section.id, { body: body as RichText })}
            value={toEditorDoc(section.body)}
          />
        </div>
      ))}
    </section>
  );
}
