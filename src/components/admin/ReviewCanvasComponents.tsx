import useSWR from "swr";
import { componentsApi } from "../../boards/creative/components/componentsApi";
import { useKitStyleSync } from "./kitStyleSync";

/** Canvas components owned by the review's selected brand kit. */
export function useReviewCanvasComponents() {
  const kitId = useKitStyleSync()?.kitId;
  return useSWR(kitId ? ["kit-components", kitId] : null, () =>
    componentsApi.list(kitId as string)
  );
}
