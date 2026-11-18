import { createContext, useContext } from "react";
import useSWR from "swr";
import { componentsApi } from "../../boards/creative/components/componentsApi";
import { useKitStyleSync } from "./kitStyleSync";

export const CanvasComponentKit = createContext<string | null | undefined>(
  undefined
);

export const useKitCanvasComponents = (kitId?: string | null) =>
  useSWR(kitId ? (["kit-components", kitId] as const) : null, ([, id]) =>
    componentsApi.list(id)
  );

export function useReviewCanvasComponents() {
  const editorKit = useContext(CanvasComponentKit);
  const reviewKit = useKitStyleSync();
  return useKitCanvasComponents(
    editorKit === undefined ? reviewKit?.kitId : editorKit
  );
}
