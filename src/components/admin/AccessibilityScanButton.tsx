import { Accessibility } from "lucide-react";
import { type RefObject, useState } from "react";
import { toast } from "sonner";
import type { ReviewScreen } from "../../../config/review.js";
import { reviewsApi } from "../../services/reviewService";
import { Button } from "../ui/button";
import type { ScreenUpdate } from "./ReviewScreenEditor";

/**
 * The screen editor's accessibility scan: the captured page checked against
 * WCAG 2.2 AA on the server, each failure pinned as an Accessibility note on
 * the element that fails (api/_lib/a11yScan.ts).
 *
 * A new scan replaces the last one's notes — they carry the rule that made
 * them — and leaves notes added by hand. Landing is one undo step.
 */
function useAccessibilityScan(
  /** The screen as it is now: a scan takes a while, and edits go on. */
  live: RefObject<ReviewScreen>,
  record: () => void,
  onChange: ScreenUpdate
) {
  const [isScanning, setIsScanning] = useState(false);
  const scan = async () => {
    const { image, sourceUrl, viewport } = live.current;
    if (!(image && sourceUrl)) {
      return;
    }
    setIsScanning(true);
    try {
      const { pins: found } = await reviewsApi.scanAccessibility({
        height: image.height,
        url: sourceUrl,
        viewport,
      });
      record();
      onChange((prev) => ({
        ...prev,
        pins: [
          ...prev.pins.filter(
            (p) => !(p.kind === "accessibility" && p.wcag?.rule)
          ),
          ...found,
        ],
      }));
      toast.success(
        found.length === 0
          ? "No WCAG failures found on this page."
          : `${found.length} accessibility ${found.length === 1 ? "note" : "notes"} added.`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not scan");
    } finally {
      setIsScanning(false);
    }
  };
  return { isScanning, scan };
}

/** "Scan accessibility": ready once the screen has a captured page. */
export function AccessibilityScanButton({
  live,
  onChange,
  record,
  screen,
}: {
  live: RefObject<ReviewScreen>;
  onChange: ScreenUpdate;
  record: () => void;
  screen: ReviewScreen;
}) {
  const { isScanning, scan } = useAccessibilityScan(live, record, onChange);
  return (
    <Button
      disabled={isScanning || !(screen.image && screen.sourceUrl)}
      onClick={() => void scan()}
      title={
        screen.sourceUrl
          ? "Check the page against WCAG 2.2 AA and pin each failure"
          : "Capture the page from its address first"
      }
      type="button"
      variant="outline"
    >
      <Accessibility size={14} />
      {isScanning ? "Scanning…" : "Scan accessibility"}
    </Button>
  );
}
