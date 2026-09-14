import { PrinterIcon } from "@hugeicons-pro/core-stroke-standard";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";
import type { BoardItem } from "../../types";
import { specFrom } from "../canvas/renderWrapNode";
import { BLEED_IN } from "../canvas/wrapLayout";
import { downloadPrintPdf } from "../io/printPdf";

/**
 * "Download print PDF", on a Print wrap node that has rendered.
 *
 * Its own file rather than a row in MenuRows.tsx, which is at the size limit;
 * MenuRows mounts it for whatever is picked and it decides for itself whether
 * to appear. The PDF is built here, at click time, from the stored render —
 * see printPdf.ts for why it is not stored alongside.
 */
export function PrintRow({
  item,
  rowClass,
}: {
  item: BoardItem;
  rowClass: string;
}) {
  const url = item.config?.wrapUrl;
  if (item.nodeType !== "wrap" || typeof url !== "string" || !url) {
    return null;
  }
  const spec = specFrom(item.config ?? {});
  const name = `${item.body?.trim() || "cover"}-print-wrap-${spec.trim}-${spec.pages}pp`;

  const save = async () => {
    const id = toast.loading("Building the print PDF…");
    try {
      await downloadPrintPdf(
        url,
        {
          bleedIn: BLEED_IN,
          heightIn: spec.canvasIn.height,
          widthIn: spec.canvasIn.width,
        },
        name
      );
      toast.success(
        `Print PDF saved — ${spec.canvasIn.width.toFixed(2)} × ${spec.canvasIn.height.toFixed(2)} in, spine ${spec.spineIn.toFixed(3)} in.`,
        { id }
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not build the print PDF",
        { id }
      );
    }
  };

  return (
    <button className={rowClass} onClick={() => void save()} type="button">
      <HugeiconsIcon aria-hidden icon={PrinterIcon} size={14} />
      <span>Download print PDF</span>
    </button>
  );
}
