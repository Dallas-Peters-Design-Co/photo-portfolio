import { Plus, Trash2 } from "lucide-react";
import {
  type BrandKitDoc,
  type BrandReference,
  MAX_KIT_NAME,
  MAX_REFERENCE_BODY,
  MAX_REFERENCES,
} from "../../../config/brandKit.js";
import { newItemId } from "../../../config/proposal.js";
import { useCollections } from "../../hooks/useCollections";
import { Button } from "../ui/button";

/**
 * The two parts of a kit that are about *finding* rather than generating: the
 * brand's image library (a linked collection) and its references (dated notes,
 * decisions and feedback). Both show up on a board's Brand panel, and the
 * references are what Claude reads and writes through the site connector.
 */

const today = (): string => new Date().toISOString().slice(0, 10);

export function LibraryPicker({
  doc,
  onChange,
}: {
  doc: BrandKitDoc;
  onChange: (next: BrandKitDoc) => void;
}) {
  const { collections, isLoading } = useCollections();
  const linked = collections.find((c) => c.id === doc.libraryCollectionId);
  return (
    <div className="stack stack--snug">
      <select
        aria-label="Image library"
        className="admin-control"
        disabled={isLoading}
        onChange={(e) =>
          onChange({ ...doc, libraryCollectionId: e.target.value || null })
        }
        value={doc.libraryCollectionId ?? ""}
      >
        <option value="">No library</option>
        {collections.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {typeof c.itemCount === "number" ? ` (${c.itemCount})` : ""}
          </option>
        ))}
      </select>
      <p className="brand-kit__hint">
        {linked
          ? "Its images appear in the Brand panel on every board, ready to drop in."
          : "Pick a collection to use as this brand's photos and past work. Add to it from any board's Collect menu."}
      </p>
    </div>
  );
}

export function ReferencesEditor({
  doc,
  onChange,
}: {
  doc: BrandKitDoc;
  onChange: (next: BrandKitDoc) => void;
}) {
  const set = (id: string, patch: Partial<BrandReference>) =>
    onChange({
      ...doc,
      references: doc.references.map((r) =>
        r.id === id ? { ...r, ...patch } : r
      ),
    });
  const add = () =>
    onChange({
      ...doc,
      references: [
        { body: "", date: today(), id: newItemId(), source: "", title: "" },
        ...doc.references,
      ],
    });
  const remove = (id: string) =>
    onChange({
      ...doc,
      references: doc.references.filter((r) => r.id !== id),
    });

  return (
    <div className="stack stack--tight">
      <div className="row row--between">
        <p className="brand-kit__hint">
          Decisions, call notes, client feedback, links to the source note.
          Newest first.
        </p>
        <Button
          disabled={doc.references.length >= MAX_REFERENCES}
          onClick={add}
          type="button"
          variant="ghost"
        >
          <Plus size={14} /> Add
        </Button>
      </div>
      {doc.references.map((ref) => (
        <div className="brand-kit__reference stack stack--snug" key={ref.id}>
          <div className="row row--snug">
            <input
              aria-label="Reference title"
              className="admin-control brand-kit__reference-title"
              maxLength={MAX_KIT_NAME}
              onChange={(e) => set(ref.id, { title: e.target.value })}
              placeholder="Title"
              value={ref.title}
            />
            <input
              aria-label="Reference date"
              className="admin-control brand-kit__reference-date"
              onChange={(e) => set(ref.id, { date: e.target.value })}
              type="date"
              value={ref.date}
            />
            <Button
              aria-label={`Remove ${ref.title || "reference"}`}
              onClick={() => remove(ref.id)}
              type="button"
              variant="ghost"
            >
              <Trash2 size={14} />
            </Button>
          </div>
          <textarea
            aria-label="Reference text"
            className="admin-control brand-kit__voice"
            maxLength={MAX_REFERENCE_BODY}
            onChange={(e) => set(ref.id, { body: e.target.value })}
            placeholder="What was decided, said or learned."
            value={ref.body}
          />
          <input
            aria-label="Reference source"
            className="admin-control"
            onChange={(e) => set(ref.id, { source: e.target.value })}
            placeholder="Source: Obsidian note, Almanac page, URL…"
            value={ref.source}
          />
        </div>
      ))}
    </div>
  );
}
