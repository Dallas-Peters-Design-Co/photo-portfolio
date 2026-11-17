import type { Collection, CollectionItem, Element } from "../types";
import { apiBase, jsonHeaders, readPageError } from "./portfolioService";

/* The elements route root, moved with the client that uses it. */
const elementsPath = (): string => `${apiBase()}/api/elements`;

/**
 * The two libraries that belong to no board: collections and elements.
 *
 * Out of portfolioService.ts for the reason brandKitService.ts left — that file
 * is under a shrink-only rule and a feature's client is a whole thing rather
 * than a section of a grab bag. These two travel together because they are the
 * same idea at different grains: a collection is a set of assets kept for reuse,
 * an element is a *style* kept for reuse, and both outlive whatever board they
 * were gathered on.
 *
 * The shared request helpers are imported rather than copied.
 */

/**
 * The library of styles, which belongs to nobody's board. Separate from
 * boardsApi because an element outlives the board it was found on: deleting
 * that board must not take the style with it.
 */
/**
 * The collections: assets kept for use in both apps. Distinct from `photosApi`,
 * which is the portfolio, and from `elementsApi`, which is a style rather than
 * a set of assets. See api/_lib/collections.ts.
 */

export const collectionsApi = {
  /** Adds one asset. Saving the same url twice is a no-op, not an error. */
  addItem: async (
    collectionId: string,
    item: {
      alt?: string | null;
      height?: number | null;
      kind?: "image" | "video";
      title?: string | null;
      url: string;
      width?: number | null;
    }
  ): Promise<CollectionItem> => {
    const res = await fetch(`${apiBase()}/api/collections/${collectionId}`, {
      body: JSON.stringify(item),
      headers: jsonHeaders(),
      method: "POST",
    });
    if (!res.ok) {
      throw new Error(
        await readPageError(res, "Could not save to the collection")
      );
    }
    describeSoon();
    return (await res.json()) as CollectionItem;
  },

  create: async (name: string, description?: string): Promise<Collection> => {
    const res = await fetch(`${apiBase()}/api/collections`, {
      body: JSON.stringify({ description, name }),
      headers: jsonHeaders(),
      method: "POST",
    });
    if (!res.ok) {
      throw new Error(
        await readPageError(res, "Could not create the collection")
      );
    }
    return (await res.json()) as Collection;
  },

  /** One collection, with its items. */
  get: async (id: string): Promise<Collection> => {
    const res = await fetch(`${apiBase()}/api/collections/${id}`, {
      headers: jsonHeaders(),
    });
    if (!res.ok) {
      throw new Error(
        await readPageError(res, "Could not load the collection")
      );
    }
    return (await res.json()) as Collection;
  },

  /** Every collection, counted rather than filled. */
  list: async (): Promise<Collection[]> => {
    const res = await fetch(`${apiBase()}/api/collections`, {
      headers: jsonHeaders(),
    });
    if (!res.ok) {
      throw new Error(await readPageError(res, "Could not load collections"));
    }
    return (await res.json()) as Collection[];
  },

  /** Deletes the whole collection. Its items go with it; the blobs do not. */
  remove: async (id: string): Promise<void> => {
    const res = await fetch(`${apiBase()}/api/collections/${id}`, {
      headers: jsonHeaders(),
      method: "DELETE",
    });
    if (!res.ok) {
      throw new Error(
        await readPageError(res, "Could not delete the collection")
      );
    }
  },

  /** Takes one asset out, leaving the collection and the blob in place. */
  removeItem: async (collectionId: string, itemId: string): Promise<void> => {
    const res = await fetch(`${apiBase()}/api/collections/${collectionId}`, {
      body: JSON.stringify({ itemId }),
      headers: jsonHeaders(),
      method: "DELETE",
    });
    if (!res.ok) {
      throw new Error(await readPageError(res, "Could not remove the asset"));
    }
  },

  update: async (
    id: string,
    patch: { coverUrl?: string | null; description?: string; name?: string }
  ): Promise<Collection> => {
    const res = await fetch(`${apiBase()}/api/collections/${id}`, {
      body: JSON.stringify(patch),
      headers: jsonHeaders(),
      method: "PATCH",
    });
    if (!res.ok) {
      throw new Error(
        await readPageError(res, "Could not save the collection")
      );
    }
    return (await res.json()) as Collection;
  },
};

/** An image found by colour and mood (api/_lib/imageSearch.ts). */
export interface ImageHit {
  colors: string[];
  description: string | null;
  height: number | null;
  id: string;
  source: "collection" | "photo";
  title: string | null;
  url: string;
  width: number | null;
}

/** Searching the library and collections, and describing images for it. */
export const imagesApi = {
  /** Describes the next few images; how many were done and how many are left. */
  describe: async (): Promise<{ described: number; left: number }> => {
    const res = await fetch(`${apiBase()}/api/collections`, {
      body: JSON.stringify({ action: "describe" }),
      headers: jsonHeaders(),
      method: "POST",
    });
    if (!res.ok) {
      throw new Error(await readPageError(res, "Could not describe images"));
    }
    return (await res.json()) as { described: number; left: number };
  },

  pending: async (): Promise<number> => {
    const res = await fetch(`${apiBase()}/api/collections?pending=1`, {
      headers: jsonHeaders(),
    });
    if (!res.ok) {
      return 0;
    }
    const { left } = (await res.json().catch(() => ({}))) as { left?: unknown };
    return typeof left === "number" ? left : 0;
  },

  search: async (q: string): Promise<ImageHit[]> => {
    const res = await fetch(
      `${apiBase()}/api/collections?search=${encodeURIComponent(q)}`,
      { headers: jsonHeaders() }
    );
    if (!res.ok) {
      throw new Error(await readPageError(res, "Could not search"));
    }
    return (await res.json()) as ImageHit[];
  },
};

let describing: ReturnType<typeof setTimeout> | null = null;
/**
 * Describes what was just saved, a moment after the last save of a burst,
 * so it can be found by colour and mood. Runs in the background; a failure
 * leaves the images to the next save or the panel's Describe button.
 */
export const describeSoon = () => {
  if (describing) {
    clearTimeout(describing);
  }
  describing = setTimeout(async () => {
    describing = null;
    for (let pass = 0; pass < 6; pass += 1) {
      // biome-ignore lint/performance/noAwaitInLoops: each pass is the server's next batch
      const step = await imagesApi.describe().catch(() => null);
      if (!step || step.left === 0 || step.described === 0) {
        return;
      }
    }
  }, 1500);
};

export const elementsApi = {
  /**
   * Saves a selection as an element.
   *
   * The pictures are sent as the addresses they already have and copied into
   * our own storage by the endpoint, not here — the browser cannot read the
   * bytes of a Pinterest image at all, which is the same wall api/boards/adopt.ts
   * exists to get past.
   */
  create: async (input: {
    coverUrl: string | null;
    description: string;
    imageUrls: string[];
    name: string;
  }): Promise<Element & { dropped?: number }> => {
    const res = await fetch(elementsPath(), {
      body: JSON.stringify(input),
      headers: jsonHeaders(),
      method: "POST",
    });
    if (!res.ok) {
      throw new Error(await readPageError(res, "Could not save that element"));
    }
    return (await res.json()) as Element & { dropped?: number };
  },

  list: async (): Promise<Element[]> => {
    const res = await fetch(elementsPath(), { headers: jsonHeaders() });
    if (!res.ok) {
      throw new Error(await readPageError(res, "Could not load elements"));
    }
    return (await res.json()) as Element[];
  },

  remove: async (id: string): Promise<void> => {
    const res = await fetch(`${elementsPath()}/${encodeURIComponent(id)}`, {
      headers: jsonHeaders(),
      method: "DELETE",
    });
    if (!res.ok) {
      throw new Error(
        await readPageError(res, "Could not delete that element")
      );
    }
  },

  update: async (
    id: string,
    input: {
      coverUrl?: string;
      description?: string;
      imageUrls?: string[];
      name?: string;
    }
  ): Promise<Element> => {
    const res = await fetch(`${elementsPath()}/${encodeURIComponent(id)}`, {
      body: JSON.stringify(input),
      headers: jsonHeaders(),
      method: "PATCH",
    });
    if (!res.ok) {
      throw new Error(await readPageError(res, "Could not save that element"));
    }
    return (await res.json()) as Element;
  },
};
