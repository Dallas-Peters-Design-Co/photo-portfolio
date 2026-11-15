import { Plus, X } from "lucide-react";
import { newItemId } from "../../../config/proposal.js";
import type { ReviewSection, RichText } from "../../../config/review.js";
import { PageEditor } from "../../cms/PageEditor";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { type CollapsedBlocks, EditorBlock } from "./EditorBlock";
import { toEditorDoc } from "./reviewEditing";
import { SortableList } from "./SortableList";

const fieldsetTitleClass =
  "text-micro-sm uppercase tracking-micro-widest text-white/70";

/**
 * The titled passages between the headline findings and the screens.
 *
 * Each is a title and its own editor, in the order the page reads them,
 * folded or open, and dragged by its handle into a new place. An audit
 * writes several at once; they are ordinary sections from then on.
 */
export function ReviewSectionsEditor({
  collapse,
  sections,
  onChange,
}: {
  collapse: CollapsedBlocks;
  sections: ReviewSection[];
  /** Given the sections as they are when the change lands, never a copy
   * from an earlier render: a rich editor keeps the handler it started with. */
  onChange: (update: (prev: ReviewSection[]) => ReviewSection[]) => void;
}) {
  const update = (id: string, patch: Partial<ReviewSection>) =>
    onChange((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const reorder = (ids: string[]) =>
    onChange((prev) =>
      ids.flatMap((id) => prev.find((s) => s.id === id) ?? [])
    );

  return (
    <section className="space-y-3">
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
      <SortableList
        itemLabel={(s) => s.title || "section"}
        items={sections}
        onReorder={reorder}
      >
        {(section, { compact, handle }) => (
          <EditorBlock
            actions={
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
            }
            collapsed={compact || collapse.isCollapsed(section.id)}
            handle={handle}
            onToggle={() => collapse.toggle(section.id)}
            title={section.title || "Untitled section"}
          >
            <div className="space-y-2">
              <Input
                aria-label="Section title"
                onChange={(e) => update(section.id, { title: e.target.value })}
                placeholder="Section title"
                size="lg"
                value={section.title}
              />
              <PageEditor
                onChange={(body) =>
                  update(section.id, { body: body as RichText })
                }
                value={toEditorDoc(section.body)}
              />
            </div>
          </EditorBlock>
        )}
      </SortableList>
    </section>
  );
}
