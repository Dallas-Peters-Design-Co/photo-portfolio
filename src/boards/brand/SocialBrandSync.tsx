import { useEffect } from "react";
import type { BoardItem } from "../../types";
import { useChosenSocialBrand } from "../studio/socialBrand";

/**
 * Keeps the brand chosen in this browser on every Social Preview node, so a
 * published board's mock-ups show it to visitors too (socialBrand.tsx).
 * Writes only when a node's copy differs; with no brand chosen, each keeps
 * the one it has. Renders nothing; sits inside the board's providers.
 */
export function SocialBrandSync({
  change,
  items,
}: {
  change: (next: BoardItem[]) => void;
  items: BoardItem[];
}) {
  const brand = useChosenSocialBrand();
  const wanted = brand ? JSON.stringify(brand) : null;
  const stale =
    wanted !== null &&
    items.some(
      (i) =>
        i.nodeType === "social" && JSON.stringify(i.config?.brand) !== wanted
    );
  useEffect(() => {
    if (!(stale && brand)) {
      return;
    }
    change(
      items.map((i) =>
        i.nodeType === "social" &&
        JSON.stringify(i.config?.brand) !== JSON.stringify(brand)
          ? { ...i, config: { ...(i.config ?? {}), brand } }
          : i
      )
    );
  }, [stale, brand, change, items]);
  return null;
}
