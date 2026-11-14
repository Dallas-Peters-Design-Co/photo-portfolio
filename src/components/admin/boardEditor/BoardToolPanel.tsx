import { HugeiconsIcon } from "@hugeicons/react";
import BrowserIcon from "@hugeicons-pro/core-stroke-standard/BrowserIcon";
import ColorsIcon from "@hugeicons-pro/core-stroke-standard/ColorsIcon";
import Film01Icon from "@hugeicons-pro/core-stroke-standard/Film01Icon";
import FrameIcon from "@hugeicons-pro/core-stroke-standard/FrameIcon";
import Image01Icon from "@hugeicons-pro/core-stroke-standard/Image01Icon";
import LinkSquare01Icon from "@hugeicons-pro/core-stroke-standard/LinkSquare01Icon";
import MagicWand01Icon from "@hugeicons-pro/core-stroke-standard/MagicWand01Icon";
import NotebookIcon from "@hugeicons-pro/core-stroke-standard/NotebookIcon";
import PackageIcon from "@hugeicons-pro/core-stroke-standard/PackageIcon";
import PaintBoardIcon from "@hugeicons-pro/core-stroke-standard/PaintBoardIcon";
import PaintBucketIcon from "@hugeicons-pro/core-stroke-standard/PaintBucketIcon";
import RepeatIcon from "@hugeicons-pro/core-stroke-standard/RepeatIcon";
import SearchVisualIcon from "@hugeicons-pro/core-stroke-standard/SearchVisualIcon";
import SparklesIcon from "@hugeicons-pro/core-stroke-standard/SparklesIcon";
import TextIcon from "@hugeicons-pro/core-stroke-standard/TextIcon";
import VideoReplayIcon from "@hugeicons-pro/core-stroke-standard/VideoReplayIcon";
import { motion } from "motion/react";
import { useState } from "react";
import type { NodeTypeId } from "../../../../config/nodeTypes.js";
import { BrandDock } from "../../../boards/panels/BrandDock";
import { openStudio } from "../../../boards/studio/studioEvents";
import { Button } from "../../ui/button";
import type { ExternalImage } from "../BoardInsertPanel";
import "./boardEditorChrome.css";

/**
 * The insert rail down the left of the board.
 *
 * Lifted out of BoardEditor.tsx, which had no room left to grow. It is a list of
 * buttons and nothing else — every handler comes from a hook — so this file can
 * be read as "what you can add to a board" without working out what any of it
 * does.
 *
 * Placing a node costs nothing. Everything here arrives idle and unwired and
 * does not spend until it is run, which is Principle VI's rule that a paid
 * operation is never a side effect of editing.
 */
export interface BoardToolPanelProps {
  onAddFrame: () => void;
  onAddNode: (nodeType: NodeTypeId, config?: Record<string, unknown>) => void;
  onAddWritable: (kind: "note" | "text") => void;
  /** Drops a brand logo or library image onto the board. */
  onInsertImage: (image: ExternalImage) => void;
  onTogglePicker: () => void;
}

export function BoardToolPanel({
  onAddFrame,
  onAddNode,
  onAddWritable,
  onInsertImage,
  onTogglePicker,
}: BoardToolPanelProps) {
  // The Brand panel lives with its button: nothing else on the board needs to
  // know whether it is open.
  const [showBrand, setShowBrand] = useState(false);
  return (
    <>
      {showBrand ? (
        <BrandDock
          onClose={() => setShowBrand(false)}
          onInsert={(img) =>
            onInsertImage({
              ...img,
              altText: null,
              creditName: null,
              creditUrl: null,
            })
          }
        />
      ) : null}
      <motion.div
        animate={{ opacity: 1, x: 0 }}
        className="board-panel board-panel--column board-tool-rail"
        initial={{ opacity: 0, x: -100 }}
        transition={{ duration: 0.5 }}
      >
        <Button
          onClick={() => onAddWritable("note")}
          stacked
          type="button"
          variant="noborder"
        >
          <HugeiconsIcon aria-hidden icon={NotebookIcon} size={14} />
          Note
        </Button>
        <Button
          onClick={() => onAddWritable("text")}
          stacked
          type="button"
          variant="noborder"
        >
          <HugeiconsIcon aria-hidden icon={TextIcon} size={14} />
          Text
        </Button>
        <Button
          onClick={onTogglePicker}
          stacked
          type="button"
          variant="noborder"
        >
          <HugeiconsIcon aria-hidden icon={Image01Icon} size={14} />
          Image
        </Button>
        <Button
          aria-pressed={showBrand}
          onClick={() => setShowBrand((v) => !v)}
          stacked
          type="button"
          variant="noborder"
        >
          <HugeiconsIcon aria-hidden icon={PaintBoardIcon} size={14} />
          Brand
        </Button>
        <Button
          onClick={() => openStudio("gradient")}
          stacked
          title="Gradients, patterns, palettes, type scales and more"
          type="button"
          variant="noborder"
        >
          <HugeiconsIcon aria-hidden icon={ColorsIcon} size={14} />
          Studio
        </Button>
        <Button
          onClick={() => onAddNode("generate")}
          stacked
          type="button"
          variant="noborder"
        >
          <HugeiconsIcon aria-hidden icon={SparklesIcon} size={14} />
          Generate
        </Button>
        <Button
          onClick={() => onAddNode("video")}
          stacked
          type="button"
          variant="noborder"
        >
          <HugeiconsIcon aria-hidden icon={VideoReplayIcon} size={14} />
          Video
        </Button>
        {/* Beside Video, which it feeds: a clip of your own to rework or extend.
          It arrives empty and takes its file on the node. */}
        <Button
          onClick={() => onAddNode("clip")}
          stacked
          type="button"
          variant="noborder"
        >
          <HugeiconsIcon aria-hidden icon={Film01Icon} size={14} />
          Clip
        </Button>
        {/* A real browser: sign in, click through a site, screenshot the
          page, then mark it up for a review. */}
        <Button
          onClick={() => onAddNode("browser")}
          stacked
          type="button"
          variant="noborder"
        >
          <HugeiconsIcon aria-hidden icon={BrowserIcon} size={14} />
          Browser
        </Button>
        <Button
          onClick={() => onAddNode("describe")}
          stacked
          type="button"
          variant="noborder"
        >
          <HugeiconsIcon aria-hidden icon={SearchVisualIcon} size={14} />
          Analyse
        </Button>
        <Button
          onClick={() => onAddNode("join")}
          stacked
          type="button"
          variant="noborder"
        >
          <HugeiconsIcon aria-hidden icon={LinkSquare01Icon} size={14} />
          Combine
        </Button>
        {/* Beside Combine: both gather what is wired in, and a Bundle is the
          one that keeps pictures, words and clips apart on their own ports. */}
        <Button
          onClick={() => onAddNode("bundle")}
          stacked
          type="button"
          variant="noborder"
        >
          <HugeiconsIcon aria-hidden icon={PackageIcon} size={14} />
          Bundle
        </Button>
        <Button
          onClick={() => onAddNode("iterate")}
          stacked
          type="button"
          variant="noborder"
        >
          <HugeiconsIcon aria-hidden icon={RepeatIcon} size={14} />
          Iterate
        </Button>
        <Button
          onClick={() => onAddNode("icon")}
          stacked
          type="button"
          variant="noborder"
        >
          <HugeiconsIcon aria-hidden icon={MagicWand01Icon} size={14} />
          Icon
        </Button>
        <Button
          onClick={() => onAddNode("palette")}
          stacked
          type="button"
          variant="noborder"
        >
          <HugeiconsIcon aria-hidden icon={PaintBoardIcon} size={14} />
          Palette
        </Button>
        <Button
          onClick={() => onAddNode("prompt")}
          stacked
          type="button"
          variant="noborder"
        >
          <HugeiconsIcon aria-hidden icon={TextIcon} size={14} />
          Prompt
        </Button>
        {/* Next to Palette rather than at the end: a brand kit is the same kind of
          thing one rung up — a palette states colours, a brand states colours,
          voice, type and a look together. */}
        <Button
          onClick={() => onAddNode("brand")}
          stacked
          type="button"
          variant="noborder"
        >
          <HugeiconsIcon aria-hidden icon={PaintBucketIcon} size={14} />
          Brand
        </Button>
        <Button onClick={onAddFrame} stacked type="button" variant="noborder">
          <HugeiconsIcon aria-hidden icon={FrameIcon} size={14} />
          Frame
        </Button>
      </motion.div>
    </>
  );
}
