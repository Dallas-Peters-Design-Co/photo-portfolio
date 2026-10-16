import { Camera, Trash2, Upload } from "lucide-react";
import { type ChangeEvent, type MouseEvent, useRef, useState } from "react";
import { toast } from "sonner";
import { newItemId } from "../../../config/proposal.js";
import type {
  PinKind,
  ReviewPin,
  ReviewScreen,
  RichText,
} from "../../../config/review.js";
import { PageEditor } from "../../cms/PageEditor";
import { portfolioService } from "../../services/portfolioService";
import { reviewsApi } from "../../services/reviewService";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { proposalInputClass, proposalLabelClass } from "./proposalStyles";
import { ReviewPinList } from "./ReviewPinList";

/**
 * One screen of a review: its picture, and the pins on it.
 *
 * The picture comes from a URL (a real browser screenshots it) or a file.
 * Clicking the picture drops a pin where the click landed, stored as a
 * fraction of the image so it stays put at any size; dragging a pin moves
 * it. The notes themselves are edited in the list beside the picture, in
 * the same order their numbers appear on it.
 */
export function ReviewScreenEditor({
  screen,
  slug,
  firstNumber,
  onChange,
  onRemove,
}: {
  screen: ReviewScreen;
  slug: string;
  /** The number the first pin on this screen carries, across the review. */
  firstNumber: number;
  onChange: (next: ReviewScreen) => void;
  onRemove: () => void;
}) {
  const [url, setUrl] = useState(screen.sourceUrl);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  let captureLabel = screen.image ? "Recapture" : "Capture";
  if (isCapturing) {
    captureLabel = "Capturing… (20–40s)";
  }

  const patch = (next: Partial<ReviewScreen>) =>
    onChange({ ...screen, ...next });

  const capture = async () => {
    const target = url.trim();
    if (!target) {
      return;
    }
    setIsCapturing(true);
    try {
      const { image } = await reviewsApi.capture({
        slug,
        url: target,
        viewport: screen.viewport,
      });
      patch({ image, sourceUrl: target });
      toast.success("Captured");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not capture");
    } finally {
      setIsCapturing(false);
    }
  };

  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) {
      return;
    }
    setIsUploading(true);
    try {
      const size = await imageSize(file);
      const { url: stored } = await portfolioService.uploadImageFile(
        file,
        undefined,
        `reviews/${slug}`
      );
      patch({ image: { ...size, url: stored } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  /** Where on the image, as fractions, a pointer event landed. */
  const at = (e: MouseEvent): { x: number; y: number } | null => {
    const box = imageRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) {
      return null;
    }
    return {
      x: Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)),
      y: Math.min(1, Math.max(0, (e.clientY - box.top) / box.height)),
    };
  };

  const addPin = (e: MouseEvent) => {
    if (dragging.current) {
      return;
    }
    const pos = at(e);
    if (!pos) {
      return;
    }
    const pin: ReviewPin = {
      ...pos,
      body: "",
      id: newItemId(),
      kind: "issue",
      title: "",
    };
    patch({ pins: [...screen.pins, pin] });
    setSelected(pin.id);
  };

  const movePin = (e: MouseEvent) => {
    if (!dragging.current) {
      return;
    }
    const pos = at(e);
    if (!pos) {
      return;
    }
    const id = dragging.current;
    patch({
      pins: screen.pins.map((p) => (p.id === id ? { ...p, ...pos } : p)),
    });
  };

  const updatePin = (id: string, next: Partial<ReviewPin>) =>
    patch({
      pins: screen.pins.map((p) => (p.id === id ? { ...p, ...next } : p)),
    });

  const removePin = (id: string) => {
    patch({ pins: screen.pins.filter((p) => p.id !== id) });
    if (selected === id) {
      setSelected(null);
    }
  };

  return (
    <div className="space-y-4 rounded-md border border-white/10 p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div className="space-y-2">
          <Label
            className={proposalLabelClass}
            htmlFor={`screen-title-${screen.id}`}
          >
            Screen title
          </Label>
          <Input
            className={proposalInputClass}
            id={`screen-title-${screen.id}`}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="Home page"
            value={screen.title}
          />
        </div>
        <div className="space-y-2">
          <Label
            className={proposalLabelClass}
            htmlFor={`screen-viewport-${screen.id}`}
          >
            Viewport
          </Label>
          <select
            className={`${proposalInputClass} rounded-md border px-3`}
            id={`screen-viewport-${screen.id}`}
            onChange={(e) =>
              patch({
                viewport: e.target.value === "mobile" ? "mobile" : "desktop",
              })
            }
            value={screen.viewport}
          >
            <option value="desktop">Desktop (1440)</option>
            <option value="mobile">Mobile (390)</option>
          </select>
        </div>
        <div className="flex items-end">
          <Button
            aria-label="Remove screen"
            onClick={onRemove}
            type="button"
            variant="ghost"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-64 flex-1 space-y-2">
          <Label
            className={proposalLabelClass}
            htmlFor={`screen-url-${screen.id}`}
          >
            Page address
          </Label>
          <Input
            className={`${proposalInputClass} font-mono`}
            id={`screen-url-${screen.id}`}
            onBlur={() => patch({ sourceUrl: url.trim() })}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://"
            type="url"
            value={url}
          />
        </div>
        <Button
          disabled={isCapturing || !url.trim()}
          onClick={() => void capture()}
          type="button"
          variant="outline"
        >
          <Camera size={14} />
          {captureLabel}
        </Button>
        <Button
          disabled={isUploading}
          onClick={() => fileInput.current?.click()}
          type="button"
          variant="outline"
        >
          <Upload size={14} />
          {isUploading ? "Uploading…" : "Upload screenshot"}
        </Button>
        <input
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => void upload(e)}
          ref={fileInput}
          type="file"
        />
      </div>

      {screen.image ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div>
            <p className="mb-2 text-[11px] text-white/60 uppercase tracking-[0.16em]">
              Click the picture to add a note · drag a pin to move it
            </p>
            {/*
              The picture is a canvas: a click places a pin where it lands,
              which has no keyboard equivalent. The pins themselves are
              buttons, and a note can also be added from the list.
            */}
            {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: pointer canvas */}
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: pointer canvas */}
            {/* biome-ignore lint/a11y/noStaticElementInteractions: pointer canvas */}
            <div
              className="relative cursor-crosshair select-none overflow-hidden rounded-md border border-white/10"
              onClick={addPin}
              onMouseLeave={() => {
                dragging.current = null;
              }}
              onMouseMove={movePin}
              onMouseUp={() => {
                // Let the click that ends a drag pass without adding a pin.
                setTimeout(() => {
                  dragging.current = null;
                }, 0);
              }}
              ref={imageRef}
            >
              <img
                alt={screen.title || "Screen"}
                className="block w-full"
                draggable={false}
                height={screen.image.height}
                src={screen.image.url}
                width={screen.image.width}
              />
              {screen.pins.map((pin, i) => (
                <button
                  aria-label={`Note ${firstNumber + i}`}
                  className={`absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white font-semibold text-[12px] text-white shadow-md ${pinColor(pin.kind)} ${selected === pin.id ? "ring-2 ring-white" : ""}`}
                  key={pin.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelected(pin.id);
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    dragging.current = pin.id;
                  }}
                  style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }}
                  type="button"
                >
                  {firstNumber + i}
                </button>
              ))}
            </div>
          </div>
          <ReviewPinList
            firstNumber={firstNumber}
            onRemove={removePin}
            onSelect={setSelected}
            onUpdate={updatePin}
            pins={screen.pins}
            selected={selected}
          />
        </div>
      ) : (
        <p className="text-sm text-white/60">
          Capture the page or upload a screenshot, then click it to add notes.
        </p>
      )}

      <div className="space-y-2">
        <Label className={proposalLabelClass}>
          About this screen (optional)
        </Label>
        <PageEditor
          onChange={(note) => patch({ note: note as RichText })}
          value={toEditorDoc(screen.note)}
        />
      </div>
    </div>
  );
}

export const pinColor = (kind: PinKind): string =>
  ({
    issue: "bg-red-500",
    praise: "bg-emerald-500",
    suggestion: "bg-sky-500",
  })[kind];

const PARAGRAPH_BREAK = /\n\s*\n/;

const toEditorDoc = (value: RichText): unknown => {
  if (typeof value !== "string") {
    return value;
  }
  return {
    content: value
      .split(PARAGRAPH_BREAK)
      .map((t) => t.trim())
      .map((text) =>
        text
          ? { content: [{ text, type: "text" }], type: "paragraph" }
          : { type: "paragraph" }
      ),
    type: "doc",
  };
};

/** The pixel size of an image file, read in the browser before upload. */
const imageSize = (file: File): Promise<{ height: number; width: number }> =>
  new Promise((resolve, reject) => {
    const src = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(src);
      resolve({ height: img.naturalHeight, width: img.naturalWidth });
    };
    img.onerror = () => {
      URL.revokeObjectURL(src);
      reject(new Error("That file is not an image"));
    };
    img.src = src;
  });
