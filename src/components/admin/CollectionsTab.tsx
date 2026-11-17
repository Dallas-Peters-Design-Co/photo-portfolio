import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCollections } from "../../hooks/useCollections";
import { collectionsApi } from "../../services/libraryService";
import type { CollectionItem } from "../../types";
import type { ExternalImage } from "./BoardInsertPanel";

/**
 * A collection's pictures, to put on the board: pick a collection, click a
 * picture. Each comes onto the board as a reference, like an Unsplash find,
 * from the address it is kept at. Videos aren't listed: a board pins stills.
 */
export function CollectionsTab({
  onAdd,
}: {
  onAdd: (image: ExternalImage) => void;
}) {
  const { collections, isLoading } = useCollections();
  const [id, setId] = useState<string | null>(null);
  const [images, setImages] = useState<CollectionItem[] | null>(null);
  const chosen = id ?? collections[0]?.id ?? null;

  useEffect(() => {
    setImages(null);
    if (!chosen) {
      return;
    }
    let live = true;
    collectionsApi
      .get(chosen)
      .then(
        (c) =>
          live && setImages((c.items ?? []).filter((i) => i.kind === "image"))
      )
      .catch(() => live && setImages([]));
    return () => {
      live = false;
    };
  }, [chosen]);

  if (!isLoading && collections.length === 0) {
    return (
      <p className="text-board-ink/50 text-micro-md">
        No collections yet. Save pictures to one from the browser extension or
        the Library.
      </p>
    );
  }

  const items = collections.map((c) => ({
    label: c.itemCount === undefined ? c.name : `${c.name} · ${c.itemCount}`,
    value: c.id,
  }));

  return (
    <div className="space-y-3">
      <Select
        items={items}
        onValueChange={(next) => next && setId(next)}
        value={chosen ?? ""}
      >
        <SelectTrigger aria-label="Collection" data-size="lg">
          <SelectValue placeholder="Pick a collection" />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {images === null && chosen ? (
        <p className="text-board-ink/50 text-micro-md">Loading…</p>
      ) : null}
      {images?.length === 0 ? (
        <p className="text-board-ink/50 text-micro-md">
          No pictures in this collection.
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        {(images ?? []).map((image) => (
          <button
            className="overflow-hidden rounded-control border border-board-ink/10 transition-colors hover:border-board-ink/50"
            key={image.id}
            onClick={() =>
              onAdd({
                altText: image.alt,
                creditName: null,
                creditUrl: null,
                imageUrl: image.url,
                thumbUrl: image.url,
              })
            }
            title={image.title ?? "Add to board"}
            type="button"
          >
            <img
              alt={image.alt ?? image.title ?? ""}
              className="aspect-square w-full object-cover"
              height={160}
              loading="lazy"
              src={image.url}
              width={160}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
