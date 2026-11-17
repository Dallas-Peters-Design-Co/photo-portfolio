import { useState } from "react";
import { toast } from "sonner";
import type { MergeImage } from "../../../../config/brandMerge.js";
import { useCollectionImages } from "../../../hooks/useCollectionImages";
import type { CollectionItem } from "../../../types";

/** One picture the merge page shows: the hero, or an option's. */
export interface PictureSlot {
  image: MergeImage | null;
  key: string;
  label: string;
  onChange: (image: MergeImage | null) => void;
}

/** A collection item's size: as stored, or read off the picture itself. */
const sizeOf = async (
  item: CollectionItem
): Promise<{ height: number; width: number }> => {
  if (item.width && item.height) {
    return { height: item.height, width: item.width };
  }
  const img = new Image();
  img.src = item.url;
  await img.decode();
  return { height: img.naturalHeight, width: img.naturalWidth };
};

function SlotStrip({
  images,
  slot,
}: {
  images: CollectionItem[];
  slot: PictureSlot;
}) {
  const [busy, setBusy] = useState(false);
  const pick = async (item: CollectionItem) => {
    if (slot.image?.url === item.url) {
      slot.onChange(null);
      return;
    }
    setBusy(true);
    try {
      slot.onChange({ ...(await sizeOf(item)), url: item.url });
    } catch {
      toast.error("Couldn't read that picture.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="review-merge__picture">
      <span className="review-merge__label">
        {slot.label}
        {busy ? " · reading…" : ""}
        {slot.image ? "" : " · none chosen"}
      </span>
      <div className="review-merge__strip">
        {images.map((item) => (
          <button
            aria-label={`Use ${item.title || item.alt || "this picture"} for ${slot.label}`}
            aria-pressed={slot.image?.url === item.url}
            className="review-merge__strip-item"
            key={item.id}
            onClick={() => void pick(item)}
            type="button"
          >
            <img alt="" height={64} loading="lazy" src={item.url} width={96} />
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The merge page's pictures chosen from a library collection: a row of the
 * collection's images under each slot, click one to use it, click it again
 * to clear it.
 */
export function CollectionPictures({
  collectionId,
  slots,
}: {
  collectionId: string;
  slots: PictureSlot[];
}) {
  const { images, isLoading } = useCollectionImages(collectionId);
  if (isLoading) {
    return <p className="review-merge__hint">Loading the collection…</p>;
  }
  if (images.length === 0) {
    return (
      <p className="review-merge__hint">This collection has no pictures.</p>
    );
  }
  return (
    <div className="review-merge__pictures review-merge__pictures--strips">
      {slots.map((slot) => (
        <SlotStrip images={images} key={slot.key} slot={slot} />
      ))}
    </div>
  );
}
