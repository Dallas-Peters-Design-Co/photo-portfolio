import { Camera, Trash2, Upload } from "lucide-react";
import {
  type ChangeEvent,
  type MouseEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { newItemId } from "../../../config/proposal.js";
import type {
  ReviewMark,
  ReviewPin,
  ReviewScreen,
  RichText,
} from "../../../config/review.js";
import { PageEditor } from "../../cms/PageEditor";
import { portfolioService } from "../../services/portfolioService";
import { reviewsApi } from "../../services/reviewService";
import { ReviewMarks, reviewPinClass } from "../review/ReviewMarkup";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { proposalInputClass, proposalLabelClass } from "./proposalStyles";
import { ReviewMarkupToolbar, type ReviewTool } from "./ReviewMarkupToolbar";
import { ReviewPinList } from "./ReviewPinList";
import {
  imageSize,
  isActiveScreen,
  isTyping,
  toEditorDoc,
  touchScreen,
  useMarkupHistory,
} from "./reviewEditing";

/** A change to a screen, applied to whatever the screen is by then. */
export type ScreenUpdate = (
  update: (prev: ReviewScreen) => ReviewScreen
) => void;

/**
 * One screen of a review: its picture, and the pins and markup on it.
 *
 * The picture comes from a URL (a real browser screenshots it) or a file.
 * Clicking the picture drops a pin where the click landed, stored as a
 * fraction of the image so it stays put at any size; dragging a pin moves
 * it. The notes themselves are edited in the list beside the picture, in
 * the same order their numbers appear on it.
 *
 * Changes go up as functions of the screen rather than finished screens: a
 * capture takes half a minute, and pins added meanwhile must survive it.
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
  onChange: ScreenUpdate;
  onRemove: () => void;
}) {
  const [url, setUrl] = useState(screen.sourceUrl);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  // A holder object, so the id can change without a re-render.
  const dragging = useRef<{ id: string | null }>({ id: null });
  const fileInput = useRef<HTMLInputElement>(null);
  const [tool, setTool] = useState<ReviewTool>("pin");
  const [draft, setDraft] = useState<ReviewMark | null>(null);
  const { marks, pins } = screen;

  let captureLabel = screen.image ? "Recapture" : "Capture";
  if (isCapturing) {
    captureLabel = "Capturing… (20–40s)";
  }

  const patch = (next: Partial<ReviewScreen>) =>
    onChange((prev) => ({ ...prev, ...next }));

  // Undo restores what is on the picture and where; a note keeps the words
  // typed since, because text edits are not steps in this history.
  const history = useMarkupHistory({ marks, pins }, (markup) =>
    patch({
      marks: markup.marks,
      pins: markup.pins.map((p) => {
        const now = pins.find((c) => c.id === p.id);
        return now ? { ...now, x: p.x, y: p.y } : p;
      }),
    })
  );

  // ⌘Z / ⇧⌘Z (Ctrl on Windows) undo the screen last worked on, unless the
  // cursor is in a text field, which keeps its own undo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        !(e.metaKey || e.ctrlKey) ||
        e.key.toLowerCase() !== "z" ||
        isTyping(e.target) ||
        !isActiveScreen(screen.id)
      ) {
        return;
      }
      e.preventDefault();
      if (e.shiftKey) {
        history.redo();
      } else {
        history.undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [history, screen.id]);

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
  const at = (
    e: MouseEvent | PointerEvent
  ): { x: number; y: number } | null => {
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
    if (dragging.current.id !== null || tool !== "pin") {
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
    history.record();
    patch({ pins: [...pins, pin] });
    setSelected(pin.id);
  };

  const movePin = (e: MouseEvent) => {
    const { id } = dragging.current;
    if (id === null) {
      return;
    }
    const pos = at(e);
    if (!pos) {
      return;
    }
    patch({ pins: pins.map((p) => (p.id === id ? { ...p, ...pos } : p)) });
  };

  const updatePin = (id: string, next: Partial<ReviewPin>) =>
    patch({ pins: pins.map((p) => (p.id === id ? { ...p, ...next } : p)) });

  const removePin = (id: string) => {
    history.record();
    patch({ pins: pins.filter((p) => p.id !== id) });
    if (selected === id) {
      setSelected(null);
    }
  };

  const eraseMark = (id: string) => {
    history.record();
    patch({ marks: marks.filter((m) => m.id !== id) });
  };

  const clearMarks = () => {
    history.record();
    patch({ marks: [] });
  };

  // Markup: press to start a mark, drag to shape it, release to keep it.
  const startMark = (e: PointerEvent<HTMLDivElement>) => {
    touchScreen(screen.id);
    if (tool === "pin" || tool === "erase" || e.button !== 0) {
      return;
    }
    const pos = at(e);
    if (!pos) {
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraft({
      id: newItemId(),
      kind: tool,
      points: [
        [pos.x, pos.y],
        [pos.x, pos.y],
      ],
    });
  };

  const shapeMark = (e: PointerEvent<HTMLDivElement>) => {
    const pos = at(e);
    if (!(draft && pos)) {
      return;
    }
    const point: [number, number] = [pos.x, pos.y];
    if (draft.kind === "pen") {
      const last = draft.points.at(-1) ?? point;
      // Skip sub-pixel jitter so a stroke stays a manageable size.
      if (Math.hypot(point[0] - last[0], point[1] - last[1]) > 0.002) {
        setDraft({ ...draft, points: [...draft.points, point] });
      }
      return;
    }
    setDraft({ ...draft, points: [draft.points[0] ?? point, point] });
  };

  const finishMark = () => {
    if (!draft) {
      return;
    }
    const [a, b] = [draft.points[0], draft.points.at(-1)];
    const span = a && b ? Math.hypot(b[0] - a[0], b[1] - a[1]) : 0;
    // A click without a drag is not a mark.
    if (span > 0.01 && draft.points.length >= 2) {
      history.record();
      patch({ marks: [...marks, draft] });
    }
    setDraft(null);
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
            <ReviewMarkupToolbar
              canClear={marks.length > 0}
              canRedo={history.canRedo}
              canUndo={history.canUndo}
              onClear={clearMarks}
              onRedo={history.redo}
              onTool={setTool}
              onUndo={history.undo}
              tool={tool}
            />
            {/*
              The picture is a canvas: a click places a pin where it lands,
              which has no keyboard equivalent. The pins themselves are
              buttons, and a note can also be added from the list.
            */}
            {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: pointer canvas */}
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: pointer canvas */}
            {/* biome-ignore lint/a11y/noStaticElementInteractions: pointer canvas */}
            <div
              className={`relative touch-none select-none overflow-hidden rounded-md border border-white/10 ${
                tool === "erase" ? "cursor-cell" : "cursor-crosshair"
              }`}
              data-review-canvas=""
              onClick={addPin}
              onMouseLeave={() => {
                dragging.current.id = null;
              }}
              onMouseMove={movePin}
              onMouseUp={() => {
                // Let the click that ends a drag pass without adding a pin.
                setTimeout(() => {
                  dragging.current.id = null;
                }, 0);
              }}
              onPointerDown={startMark}
              onPointerMove={shapeMark}
              onPointerUp={finishMark}
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
              <ReviewMarks
                draft={draft}
                height={screen.image.height}
                marks={marks}
                onSelect={tool === "erase" ? eraseMark : undefined}
                width={screen.image.width}
              />
              {pins.map((pin, i) => (
                <button
                  aria-label={`Note ${firstNumber + i}`}
                  className={`${reviewPinClass(pin.kind)} ${selected === pin.id ? "ring-2 ring-white" : ""}`}
                  key={pin.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (tool === "erase") {
                      removePin(pin.id);
                    } else {
                      setSelected(pin.id);
                    }
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    if (tool !== "erase") {
                      history.record();
                      dragging.current.id = pin.id;
                    }
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
            pins={pins}
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
