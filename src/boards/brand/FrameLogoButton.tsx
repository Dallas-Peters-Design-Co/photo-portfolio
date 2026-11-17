import { useState } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { Button } from "@/components/ui/button";
import { MAX_LOGOS } from "../../../config/brandKit.js";
import { brandKitsApi } from "../../services/brandKitService";
import type { BoardItem } from "../../types";
import { useFrameActions } from "../FrameOpenContext";
import { useActiveBrand } from "./ActiveBrand";

/**
 * On a selected designed frame: draws it as one picture and adds it to the
 * board's brand (the Brand panel's choice) as a logo, named after the frame.
 * Nothing for a plain frame, without a brand, or where frames can't be drawn.
 */
export function FrameLogoButton({ item }: { item: BoardItem }) {
  const kit = useActiveBrand()?.kit ?? null;
  const { frameImage } = useFrameActions();
  const { mutate } = useSWRConfig();
  const [busy, setBusy] = useState(false);
  if (
    !(kit && frameImage) ||
    item.kind !== "frame" ||
    item.config?.designed !== true
  ) {
    return null;
  }
  const add = async () => {
    // A sub-brand using its parent's logos starts from those, so adding one
    // doesn't hide the rest.
    const base =
      kit.doc.logos.length > 0 ? kit.doc.logos : kit.resolvedDoc.logos;
    if (base.length >= MAX_LOGOS) {
      toast.error(`${kit.name} already has ${MAX_LOGOS} logos.`);
      return;
    }
    setBusy(true);
    try {
      const { url } = await frameImage(item.id);
      const label = item.body?.trim() || "Logo";
      await brandKitsApi.save(kit.id, {
        ...kit.doc,
        logos: [...base, { clearSpace: 0, label, minWidth: 0, rules: "", url }],
      });
      await mutate((key) => Array.isArray(key) && key[0] === "brand-kits");
      toast.success(`${label} added to ${kit.name}'s logos`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't add the logo."
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button
      disabled={busy}
      onClick={() => void add()}
      size="xs"
      title={`Draw this frame and add it to ${kit.name}'s logos`}
      variant="ghost"
    >
      {busy ? "Adding…" : "Brand logo"}
    </Button>
  );
}
