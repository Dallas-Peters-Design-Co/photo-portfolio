import Delete02Icon from "@hugeicons-pro/core-stroke-standard/Delete02Icon";
import Edit02Icon from "@hugeicons-pro/core-stroke-standard/Edit02Icon";
import FolderLibraryIcon from "@hugeicons-pro/core-stroke-standard/FolderLibraryIcon";
import { Plus, X } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { isVideoUrl } from "../../boards/io/isVideo";
import { useCollections } from "../../hooks/useCollections";
import { collectionsApi } from "../../services/libraryService";
import type { Collection, CollectionItem } from "../../types";
import { AdminCard } from "./AdminFrame";
import {
  AdminEmpty,
  AdminList,
  AdminListNote,
  AdminListPage,
  AdminRowAction,
} from "./AdminList";
import { useConfirm } from "./ConfirmProvider";

const labelClass = "text-sm uppercase tracking-widest text-white/90";

/**
 * The collections, and what is in them.
 *
 * A collection is neither the portfolio nor a board: it is material both apps
 * read. Nothing here is published by being here, which is what `photos` could
 * not express — an unpublished photograph reads as a draft, where these are
 * deliberately never on the site. See db/patches/029_collections.sql.
 *
 * One panel rather than a list route and a detail route. A collection is a name
 * and some pictures; opening one is expanding it, not going somewhere, and a
 * second route would mean losing the list to look at a dozen thumbnails.
 */

/** A thumbnail that knows a clip from a picture. */
function AssetTile({
  item,
  onRemove,
}: {
  item: CollectionItem;
  onRemove: () => void;
}) {
  return (
    <div className="group relative overflow-hidden rounded-control border border-white/10">
      {isVideoUrl(item.url) || item.kind === "video" ? (
        // Muted, and no autoplay: a grid of a dozen clips all playing at once
        // is unreadable, and the poster frame is enough to recognise one by.
        // `#t=0.1` is what makes that frame appear — asked for frame zero,
        // several browsers show nothing until the video is played.
        <video
          className="aspect-square w-full object-cover"
          muted
          preload="metadata"
          src={`${item.url}#t=0.1`}
        >
          <track kind="captions" />
        </video>
      ) : (
        <img
          alt={item.alt ?? item.title ?? ""}
          className="aspect-square w-full object-cover"
          decoding="async"
          height={200}
          loading="lazy"
          src={item.url}
          width={200}
        />
      )}
      <div className="absolute top-1 right-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <Button
          aria-label="Remove from collection"
          onClick={onRemove}
          size="icon-xs"
          tone="danger"
          variant="ghost"
        >
          ×
        </Button>
      </div>
    </div>
  );
}

/**
 * One collection: its name, its count, and its assets once opened.
 *
 * A row of the shared list, drawn here rather than with AdminListRow: the
 * title has to turn into a field to be renamed and to say whether it is
 * expanded, and what opens under it is a grid of pictures, not a form. The
 * spacing and type are AdminListRow's, so it reads as one.
 */
function CollectionRow({
  collection,
  onChanged,
}: {
  collection: Collection;
  onChanged: () => Promise<unknown>;
}) {
  const { confirm } = useConfirm();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CollectionItem[] | null>(null);
  const [name, setName] = useState(collection.name);
  const [renaming, setRenaming] = useState(false);

  /**
   * Loaded when opened, not with the list.
   *
   * The list sends a count rather than the items, so the first look at one has
   * to fetch. Kept locally afterwards: re-reading on every expand would make
   * opening the same collection twice cost twice.
   */
  const expand = async () => {
    setOpen((was) => !was);
    if (items) {
      return;
    }
    try {
      const full = await collectionsApi.get(collection.id);
      setItems(full.items ?? []);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not open the collection"
      );
    }
  };

  const rename = async () => {
    const next = name.trim();
    if (!next || next === collection.name) {
      setRenaming(false);
      setName(collection.name);
      return;
    }
    try {
      await collectionsApi.update(collection.id, { name: next });
      setRenaming(false);
      await onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not rename it");
    }
  };

  const removeCollection = async () => {
    const ok = await confirm({
      confirmLabel: "Delete",
      description: `"${collection.name}" and its ${collection.itemCount ?? 0} assets will be removed. The pictures themselves are kept — they may be on a board or in another collection.`,
      destructive: true,
      title: "Delete this collection?",
    });
    if (!ok) {
      return;
    }
    try {
      await collectionsApi.remove(collection.id);
      await onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete it");
    }
  };

  const removeItem = async (item: CollectionItem) => {
    try {
      await collectionsApi.removeItem(collection.id, item.id);
      setItems((current) => current?.filter((i) => i.id !== item.id) ?? null);
      await onChanged();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not remove the asset"
      );
    }
  };

  const count = collection.itemCount ?? 0;

  return (
    <li>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-6 py-5">
        {renaming ? (
          <div className="min-w-0 flex-1">
            <Input
              aria-label="Collection name"
              onBlur={() => void rename()}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void rename();
                }
                if (e.key === "Escape") {
                  setRenaming(false);
                  setName(collection.name);
                }
              }}
              size="lg"
              value={name}
            />
          </div>
        ) : (
          <button
            aria-expanded={open}
            className="min-w-0 flex-1 text-left"
            onClick={() => void expand()}
            type="button"
          >
            <span className="block truncate text-lg text-white leading-snug">
              {collection.name}
            </span>
            <span className="mt-1 block text-sm text-white/60 tabular-nums">
              {count} {count === 1 ? "asset" : "assets"}
            </span>
          </button>
        )}
        <div className="flex shrink-0 items-center gap-1">
          <AdminRowAction
            icon={Edit02Icon}
            label="Rename"
            onClick={() => setRenaming(true)}
          />
          <AdminRowAction
            danger
            icon={Delete02Icon}
            label="Delete"
            onClick={() => void removeCollection()}
          />
        </div>
      </div>

      {open ? (
        <div className="px-6 pb-5">
          {items === null ? <AdminListNote>Loading…</AdminListNote> : null}
          {items?.length === 0 ? (
            <AdminListNote>
              Empty. Save something into it from a board.
            </AdminListNote>
          ) : null}
          {items && items.length > 0 ? (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {items.map((item) => (
                <AssetTile
                  item={item}
                  key={item.id}
                  onRemove={() => void removeItem(item)}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export function CollectionsPanel() {
  const { collections, error, isLoading, refresh } = useCollections();
  const [name, setName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    const title = name.trim();
    if (!title) {
      return;
    }
    try {
      await collectionsApi.create(title);
      setName("");
      setIsCreating(false);
      await refresh();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not create the collection"
      );
    }
  };

  return (
    <AdminListPage
      action={
        <Button
          onClick={() => setIsCreating((v) => !v)}
          type="button"
          variant="ghost"
        >
          {isCreating ? <X size={14} /> : <Plus size={14} />}
          {isCreating ? "Cancel" : "New collection"}
        </Button>
      }
      icon={FolderLibraryIcon}
      title="Collections"
    >
      <AdminListNote>
        Assets kept for use in boards and pages. Nothing here appears on the
        site — that is what the photo library is for.
      </AdminListNote>

      {isCreating ? (
        <form onSubmit={(e) => void create(e)}>
          <AdminCard>
            <CardHeader>New collection</CardHeader>
            <CardContent>
              <div className="space-y-2">
                <label className={labelClass} htmlFor="new-collection-name">
                  Name
                </label>
                <Input
                  aria-label="New collection name"
                  autoFocus
                  id="new-collection-name"
                  onChange={(e) => setName(e.target.value)}
                  placeholder="New collection…"
                  size="lg"
                  value={name}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button
                disabled={name.trim().length === 0}
                type="submit"
                variant="outline"
              >
                Create
              </Button>
            </CardFooter>
          </AdminCard>
        </form>
      ) : null}

      {isLoading ? <AdminListNote>Loading…</AdminListNote> : null}
      {error ? (
        <AdminListNote tone="warn">Could not load collections.</AdminListNote>
      ) : null}
      {!isLoading && collections.length === 0 ? (
        <AdminEmpty>
          No collections yet. Start one with New collection, or save a selection
          into a new one from a board.
        </AdminEmpty>
      ) : null}

      {collections.length > 0 ? (
        <AdminList>
          {collections.map((collection) => (
            <CollectionRow
              collection={collection}
              key={collection.id}
              onChanged={refresh}
            />
          ))}
        </AdminList>
      ) : null}
    </AdminListPage>
  );
}
