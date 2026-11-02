import useSWR from "swr";
import { collectionsApi } from "../services/libraryService";
import type { CollectionItem } from "../types";

/**
 * The pictures in a brand's linked library collection. Shared by the kit
 * editor, the brand guide and a board's Brand panel, under one SWR key, so
 * adding to the collection anywhere shows up everywhere after a refresh.
 */
export const useCollectionImages = (
  collectionId: string | null | undefined
): { images: CollectionItem[]; isLoading: boolean } => {
  const { data, isLoading } = useSWR(
    collectionId ? ["collection", collectionId] : null,
    () => collectionsApi.get(collectionId as string)
  );
  return {
    images: (data?.items ?? []).filter((item) => item.kind === "image"),
    isLoading,
  };
};
