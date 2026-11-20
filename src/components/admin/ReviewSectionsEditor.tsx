import { Plus, Trash2, X } from "lucide-react";
import type { BrandKitDoc } from "../../../config/brandKit.js";
import { newItemId } from "../../../config/proposal.js";
import type { ReviewSection, RichText } from "../../../config/review.js";
import { MAX_REVIEW_CONCEPTS } from "../../../config/reviewConcept.js";
import { PageEditor } from "../../cms/PageEditor";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { type CollapsedBlocks, EditorBlock } from "./EditorBlock";
import { ReviewConceptsEditor } from "./ReviewConceptsEditor";
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
  brandDoc,
  collapse,
  sections,
  totalConcepts,
  onChange,
}: {
  brandDoc: BrandKitDoc | null;
  collapse: CollapsedBlocks;
  sections: ReviewSection[];
  totalConcepts: number;
  /** Given the sections as they are when the change lands, never a copy
   * from an earlier render: a rich editor keeps the handler it started with. */
  onChange: (update: (prev: ReviewSection[]) => ReviewSection[]) => void;
}) {
  const update = (id: string, patch: Partial<ReviewSection>) =>
    onChange((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const addRecommendation = (section: ReviewSection) =>
    update(section.id, {
      recommendations: [
        ...(section.recommendations ?? []),
        { body: "", id: newItemId(), title: "" },
      ],
    });

  const addStandaloneRecommendation = () =>
    onChange((prev) => {
      const section = prev.find(
        (item) => item.title.trim().toLowerCase() === "recommendations"
      );
      const recommendation = { body: "", id: newItemId(), title: "" };
      if (section) {
        return prev.map((item) =>
          item.id === section.id
            ? {
                ...item,
                recommendations: [
                  ...(item.recommendations ?? []),
                  recommendation,
                ],
              }
            : item
        );
      }
      return [
        ...prev,
        {
          body: "",
          id: newItemId(),
          recommendations: [recommendation],
          title: "Recommendations",
        },
      ];
    });

  const updateRecommendation = (
    sectionId: string,
    recommendationId: string,
    patch: Partial<NonNullable<ReviewSection["recommendations"]>[number]>
  ) =>
    onChange((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              recommendations: (section.recommendations ?? []).map((item) =>
                item.id === recommendationId ? { ...item, ...patch } : item
              ),
            }
          : section
      )
    );

  const removeRecommendation = (sectionId: string, recommendationId: string) =>
    onChange((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              recommendations: (section.recommendations ?? []).filter(
                (item) => item.id !== recommendationId
              ),
            }
          : section
      )
    );

  const reorder = (ids: string[]) =>
    onChange((prev) =>
      ids.flatMap((id) => prev.find((s) => s.id === id) ?? [])
    );

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className={fieldsetTitleClass}>Sections</h3>
        <div className="flex items-center gap-2">
          <Button
            onClick={addStandaloneRecommendation}
            type="button"
            variant="ghost"
          >
            <Plus size={14} /> Add recommendation
          </Button>
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
              <div className="space-y-3 border-white/10 border-t pt-3">
                <div className="flex items-center justify-between">
                  <h4 className={fieldsetTitleClass}>Recommendations</h4>
                  <Button
                    onClick={() => addRecommendation(section)}
                    type="button"
                    variant="ghost"
                  >
                    <Plus size={14} /> Add recommendation
                  </Button>
                </div>
                {(section.recommendations ?? []).map((recommendation) => {
                  const otherConcepts =
                    totalConcepts - (recommendation.concepts?.length ?? 0);
                  const conceptLimit = Math.max(
                    0,
                    MAX_REVIEW_CONCEPTS - otherConcepts
                  );
                  return (
                    <div
                      className="space-y-2 border border-white/10 p-3"
                      key={recommendation.id}
                    >
                      <div className="flex items-center gap-2">
                        <Input
                          aria-label="Recommendation title"
                          onChange={(event) =>
                            updateRecommendation(
                              section.id,
                              recommendation.id,
                              {
                                title: event.target.value,
                              }
                            )
                          }
                          placeholder="Recommendation title"
                          size="lg"
                          value={recommendation.title}
                        />
                        <Button
                          aria-label="Remove recommendation"
                          onClick={() =>
                            removeRecommendation(section.id, recommendation.id)
                          }
                          size="icon"
                          type="button"
                          variant="ghost"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                      <PageEditor
                        onChange={(body) =>
                          updateRecommendation(section.id, recommendation.id, {
                            body: body as RichText,
                          })
                        }
                        value={toEditorDoc(recommendation.body)}
                      />
                      <ReviewConceptsEditor
                        brandDoc={brandDoc}
                        concepts={recommendation.concepts ?? []}
                        maxConcepts={conceptLimit}
                        onChange={(concepts) =>
                          updateRecommendation(section.id, recommendation.id, {
                            concepts,
                          })
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </EditorBlock>
        )}
      </SortableList>
    </section>
  );
}
