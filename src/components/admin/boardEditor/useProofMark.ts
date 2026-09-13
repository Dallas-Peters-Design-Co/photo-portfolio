import { toast } from "sonner";
import { useProofBoard } from "../../../boards/brand/useProofBoard";
import { useBrandKits } from "../../../hooks/useBrandKits";
import type { BoardItem } from "../../../types";

/**
 * Proofing the mark a Brand node is already pointing at.
 *
 * The kit panel's button makes a board of its own, which is right when a
 * review is the thing you sat down to do. This is the other case: the mark is
 * already wired into the work in front of you, and being sent to a different
 * board to look at it is the interruption rather than the help.
 *
 * Everything it needs is on the node. A Brand node stores which kit and which
 * logo — by URL rather than by index, because an index into the kit's list
 * moves the moment a logo is deleted — so there is nothing to ask the user.
 */
export const useProofMark = (
  items: BoardItem[],
  change: (next: BoardItem[]) => void,
  dropPoint: (
    items: BoardItem[],
    w: number,
    h: number
  ) => { x: number; y: number }
) => {
  const { kits } = useBrandKits();
  const { proofItemsFor } = useProofBoard();

  const proofMark = async (itemId: string) => {
    const node = items.find((item) => item.id === itemId);
    const config = (node?.config ?? {}) as Record<string, unknown>;
    const kit = kits.find((entry) => entry.id === config.brandKitId);
    const logo = kit?.resolvedDoc.logos.find(
      (entry) => entry.url === config.logoUrl
    );
    if (!(kit && logo)) {
      toast.error(
        "Pick a brand kit and a logo on this node before proofing it"
      );
      return;
    }
    const toastId = toast.loading("Drawing the proof sheet…");
    try {
      const placed = await proofItemsFor(
        { doc: kit.resolvedDoc, name: kit.name },
        logo,
        dropPoint(items, 640, 480)
      );
      change([...items, ...placed]);
      toast.dismiss(toastId);
      toast.success(`${placed.length} proof tiles added`);
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(
        err instanceof Error ? err.message : "Could not draw the proof sheet"
      );
    }
  };

  return { proofMark };
};
