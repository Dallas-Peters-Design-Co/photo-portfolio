import { HugeiconsIcon } from "@hugeicons/react";
import SparklesIcon from "@hugeicons-pro/core-stroke-standard/SparklesIcon";
import { useState } from "react";
import { toast } from "sonner";
import { ICON_STYLES, type IconStyle } from "../../../config/iconStyles";
import { aiApi, type GeneratedIcon } from "../../services/portfolioService";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import type { ExternalImage } from "./BoardInsertPanel";

/**
 * Drawing an icon from a description.
 *
 * Its own component, but its state belongs to the panel: switching to Unsplash
 * and back must not discard an icon that has just been paid for.
 */
export function IconTab({ onAdd }: { onAdd: (image: ExternalImage) => void }) {
  // Held here rather than in the panel. The panel was carrying the state of
  // every tab at once, which is what pushed it past the complexity limit as
  // the ninth tab landed — a tab's working state belongs to the tab.
  const [prompt, onPrompt] = useState("");
  const [style, onStyle] = useState<IconStyle>(ICON_STYLES[0]);
  const [icon, setIcon] = useState<GeneratedIcon | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const onDraw = async () => {
    const text = prompt.trim();
    if (!text) {
      return;
    }
    setIsDrawing(true);
    setIcon(null);
    try {
      setIcon(await aiApi.generateIcon(text, style));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not draw that");
    } finally {
      setIsDrawing(false);
    }
  };

  return (
    <div className="space-y-3">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void onDraw();
        }}
      >
        <Input
          onChange={(e) => onPrompt(e.target.value)}
          placeholder="Describe an icon…"
          size="lg"
          tone="board"
          value={prompt}
        />
        <div className="flex flex-wrap gap-1">
          {ICON_STYLES.map((option) => (
            <button
              className={`min-h-8 px-2 text-micro-xs uppercase tracking-micro transition-colors ${
                style === option
                  ? "bg-board-ink/10 text-board-ink"
                  : "text-board-ink/40 hover:text-board-ink/80"
              }`}
              key={option}
              onClick={() => onStyle(option)}
              type="button"
            >
              {option}
            </button>
          ))}
        </div>

        <Button disabled={isDrawing} fullWidth type="submit" variant="outline">
          <HugeiconsIcon aria-hidden icon={SparklesIcon} size={14} />
          {isDrawing ? "Drawing…" : "Draw icon"}
        </Button>
      </form>

      {icon ? (
        <div className="space-y-2">
          {/* Pale backing: a solid icon is usually dark, and against the
              panel's black it would look like an empty box. */}
          <div className="flex items-center justify-center rounded-control border border-board-ink/10 bg-board-ink/90 p-4">
            <img
              alt="Generated icon"
              className="h-24 w-24 object-contain"
              height={96}
              src={icon.url}
              width={96}
            />
          </div>
          <Button
            fullWidth
            onClick={() =>
              onAdd({
                altText: prompt.slice(0, 200),
                // Generated, so there is no one to credit.
                creditName: null,
                creditUrl: null,
                imageUrl: icon.url,
                thumbUrl: icon.url,
              })
            }
            type="button"
            variant="outline"
          >
            Add to board
          </Button>
        </div>
      ) : null}

      {icon && !icon.isVector ? (
        <p className="text-amber-300/70 text-micro-xs leading-relaxed">
          Magnific's vectoriser was unavailable, so this came back as a PNG
          rather than an SVG. It still works on the board; it will not stay
          sharp all the way in.
        </p>
      ) : null}

      <p className="text-board-ink/30 text-micro-xs leading-relaxed">
        Icons are drawn as SVG so they stay sharp at any zoom, falling back to
        PNG when the vectoriser is down. Simple shapes vectorise best.
      </p>
    </div>
  );
}
