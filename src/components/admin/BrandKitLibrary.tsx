import { Plus, Trash2 } from "lucide-react";
import {
  type BrandKitDoc,
  type BrandReference,
  MAX_KIT_NAME,
  MAX_REFERENCE_BODY,
  MAX_REFERENCES,
} from "../../../config/brandKit.js";
import { newItemId } from "../../../config/proposal.js";
import { useCollectionImages } from "../../hooks/useCollectionImages";
import { useCollections } from "../../hooks/useCollections";
import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { BrandImagesEditor } from "./BrandImagesEditor";

/**
 * The two parts of a kit that are about *finding* rather than generating: the
 * brand's image library (a linked collection) and its references (dated notes,
 * decisions and feedback). Both show up on a board's Brand panel, and the
 * references are what Claude reads and writes through the site connector.
 */

const today = (): string => new Date().toISOString().slice(0, 10);

/** A collection as the library menu shows it, with its size when known. */
const libraryLabel = (c: {
  itemCount?: number | null;
  name: string;
}): string =>
  typeof c.itemCount === "number" ? `${c.name} (${c.itemCount})` : c.name;

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
      <Select
        disabled={isLoading}
        items={[
          { label: "No library", value: "" },
          ...collections.map((c) => ({
            label: libraryLabel(c),
            value: c.id,
          })),
        ]}
        onValueChange={(value) => {
          if (value !== null) {
            onChange({ ...doc, libraryCollectionId: value || null });
          }
        }}
        value={doc.libraryCollectionId ?? ""}
      >
        <SelectTrigger aria-label="Image library" disabled={isLoading}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">No library</SelectItem>
          {collections.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {libraryLabel(c)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="brand-kit__hint">
        {linked
          ? "Its images appear in the Brand panel on every board, ready to drop in."
          : "Pick a collection to use as this brand's photos and past work. Add to it from any board's Collect menu."}
      </p>
      {linked ? <LibraryImages collectionId={linked.id} /> : null}
      {/* Reference images live here too: picked from that library, the
          photo library, or uploaded. */}
      <BrandImagesEditor doc={doc} onChange={onChange} />
    </div>
  );
}

/** The linked collection's pictures, so the kit shows what it holds. */
function LibraryImages({ collectionId }: { collectionId: string }) {
  const { images, isLoading } = useCollectionImages(collectionId);
  if (isLoading) {
    return <p className="brand-kit__hint">Loading the library…</p>;
  }
  if (images.length === 0) {
    return (
      <p className="brand-kit__hint">
        This collection is empty. Add to it from any board's Collect menu.
      </p>
    );
  }
  return (
    <div className="brand-kit__library">
      {images.map((item) => (
        <img
          alt={item.alt ?? ""}
          height={96}
          key={item.id}
          loading="lazy"
          src={item.url}
          title={item.title ?? undefined}
          width={96}
        />
      ))}
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
