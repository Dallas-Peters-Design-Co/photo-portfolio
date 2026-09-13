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
    if (!kit) {
      toast.error(
        kits.length === 0
          ? "Brand kits are still loading"
          : "Pick a brand kit on this node before proofing it"
      );
      return;
    }
    /*
     * The node's chosen mark, or the kit's first.
     *
     * The logo picker on a Brand node answers a different question — which
     * mark gets stamped onto a generation — and most nodes never touch it,
     * because most boards never stamp. Requiring it here refused three nodes
     * out of four for a setting that has nothing to do with proofing.
     *
     * A kit with no logos at all is the real refusal, and it says so.
     */
    const { logos } = kit.resolvedDoc;
    const logo =
      logos.find((entry) => entry.url === config.logoUrl) ?? logos[0];
    if (!logo) {
      toast.error(`"${kit.name}" has no logo to proof yet`);
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
