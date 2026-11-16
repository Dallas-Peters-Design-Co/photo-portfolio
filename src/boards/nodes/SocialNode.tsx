import type { RefObject } from "react";
import { SOCIAL } from "../../../config/nodes/social.js";
import {
  isSocialPreviewId,
  type SocialPreviewId,
} from "../../../config/socialPreview";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import type { BoardItem } from "../../types";
import { PANEL_GAP } from "../geometry/panelPlacement";
import { useAnchoredPanel } from "../panels/useAnchoredPanel";
import { SocialPreview } from "../studio/SocialPreview";
import "./SocialNode.css";

/**
 * A Social Preview node: the mock-up and nothing else.
 *
 * No header, no settings, no node card around it. The node exists to show
 * how a picture will look on a platform, and node chrome round a mock-up of
 * a post reads as part of the post. The platform is picked from a bar that
 * hangs above it while it's selected (SocialToolBar), like a text item's.
 */

const PLATFORM = SOCIAL.settings.find((s) => s.kind === "select");
const OPTIONS: readonly string[] =
  PLATFORM?.kind === "select" ? PLATFORM.options : [];
const LABELS: Record<string, string> =
  PLATFORM?.kind === "select" ? (PLATFORM.optionLabels ?? {}) : {};
const DEFAULT_PLATFORM: SocialPreviewId = "facebook-post";

export const platformOf = (item: BoardItem): SocialPreviewId =>
  isSocialPreviewId(item.config?.platform)
    ? item.config.platform
    : DEFAULT_PLATFORM;

export function SocialNode({
  imageUrl,
  item,
}: {
  imageUrl?: string | null;
  item: BoardItem;
}) {
  return (
    <div className="social-node">
      <SocialPreview platform={platformOf(item)}>
        {imageUrl ? (
          <img
            alt="Connected frame artwork"
            decoding="async"
            height={1200}
            src={imageUrl}
            width={1200}
          />
        ) : (
          <div className="social-node__empty">
            Connect a frame to preview it
          </div>
        )}
      </SocialPreview>
    </div>
  );
}

/** The platform picker, above the selected node, one size at any zoom. */
export function SocialToolBar({
  anchor,
  chromeScale,
  item,
  onPatch,
}: {
  anchor: RefObject<HTMLElement | null>;
  chromeScale: { transform: string };
  item: BoardItem;
  onPatch: (patch: Partial<BoardItem>) => void;
}) {
  const { panelRef, placement } = useAnchoredPanel(anchor);
  const above = placement === "above";
  if (item.nodeType !== "social") {
    return null;
  }
  return (
    // Swallows its own presses, or the canvas reads a press on the picker
    // as the start of a drag (as BoardTextTools does).
    <div
      className={`social-toolbar ${
        above ? "social-toolbar--above" : "social-toolbar--below"
      }`}
      onPointerDown={(e) => e.stopPropagation()}
      ref={panelRef}
      style={{
        transform: `${chromeScale.transform} translateY(${above ? -PANEL_GAP : PANEL_GAP}px)`,
      }}
    >
      <Select
        items={LABELS}
        onValueChange={(value) =>
          onPatch({ config: { ...(item.config ?? {}), platform: value } })
        }
        value={platformOf(item)}
      >
        <SelectTrigger aria-label="Platform" size="sm" tone="board">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {OPTIONS.map((id) => (
              <SelectItem key={id} value={id}>
                {LABELS[id] ?? id}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
