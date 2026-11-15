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
import type { BrandKitDoc } from "../../../config/brandKit.js";
import { newItemId } from "../../../config/proposal.js";
import type {
  ReviewPin,
  ReviewScreen,
  RichText,
} from "../../../config/review.js";
import { MAX_REVIEW_CONCEPTS } from "../../../config/reviewConcept.js";
import { PageEditor } from "../../cms/PageEditor";
import { portfolioService } from "../../services/portfolioService";
import { reviewsApi } from "../../services/reviewService";
import { MarkEditLayer } from "../review/MarkEditLayer";
import { ReviewMarks, reviewPinClass } from "../review/ReviewMarkup";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { ReviewMarkupToolbar, type ReviewTool } from "./ReviewMarkupToolbar";
import { ReviewPinList } from "./ReviewPinList";
import {
  captureLabelFor,
  imageSize,
  isActiveScreen,
  isTyping,
  orderPins,
  RECAPTURE_HINT,
  readingOrder,
  replaceScreenImage,
  toEditorDoc,
  useMarkupHistory,
} from "./reviewEditing";
import "./ReviewScreenEditor.css";
import { useReviewMarkup } from "./useReviewMarkup";

const VIEWPORT_ITEMS = [
  { label: "Desktop (1440)", value: "desktop" },
  { label: "Mobile (390)", value: "mobile" },
];

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
  conceptLimit = MAX_REVIEW_CONCEPTS,
  brandDoc,
  onChange,
  onRemove,
}: {
  screen: ReviewScreen;
  slug: string;
  /** The number the first pin on this screen carries, across the review. */
  firstNumber: number;
  /** Remaining concept slots for this screen after concepts on other screens. */
  conceptLimit?: number;
  brandDoc?: BrandKitDoc | null;
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
  const { marks, pins } = screen;
  // The screen now, for a capture that lands long after this render.
  const live = useRef(screen);
  live.current = screen;

  const captureLabel = captureLabelFor(isCapturing, Boolean(screen.image));

  const patch = (next: Partial<ReviewScreen>) =>
    onChange((prev) => ({ ...prev, ...next }));

  // Undo restores what is on the picture and where; a note keeps the words
  // typed since, because text edits are not steps in this history.
  const history = useMarkupHistory({ marks, pins }, (restored) =>
    patch({
      marks: restored.marks,
      pins: restored.pins.map((p) => {
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
      replaceScreenImage(live.current, image, onChange, { sourceUrl: target });
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
      replaceScreenImage(live.current, { ...size, url: stored }, onChange);
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
    // With the Edit tool, a click off every mark lets go of the selection.
    if (tool === "select") {
      markup.setSelectedMark(null);
      return;
    }
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

  /** A change that is one undo step. */
  const step = (next: Partial<ReviewScreen>) => {
    history.record();
    patch(next);
  };
  const readingPinIds = readingOrder(pins, screen.image);
  const canOrderPins =
    pins.length > 1 &&
    readingPinIds.join() !== pins.map((pin) => pin.id).join();

  const markup = useReviewMarkup({
    at,
    marks,
    record: history.record,
    screenId: screen.id,
    setMarks: (next) => patch({ marks: next }),
    tool,
  });

  return (
    <div className="space-y-4">
      <div className="review-screen-editor__address">
        <div className="space-y-2">
          <Label htmlFor={`screen-title-${screen.id}`}>Screen title</Label>
          <Input
            id={`screen-title-${screen.id}`}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="Home page"
            size="lg"
            value={screen.title}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`screen-viewport-${screen.id}`}>Viewport</Label>
          <Select
            items={VIEWPORT_ITEMS}
            onValueChange={(value) => {
              if (value !== null) {
                patch({ viewport: value === "mobile" ? "mobile" : "desktop" });
              }
            }}
            value={screen.viewport}
          >
            <SelectTrigger id={`screen-viewport-${screen.id}`} size="lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VIEWPORT_ITEMS.map((v) => (
                <SelectItem key={v.value} value={v.value}>
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          <Label htmlFor={`screen-url-${screen.id}`}>Page address</Label>
          <Input
            face="mono"
            id={`screen-url-${screen.id}`}
            onBlur={() => patch({ sourceUrl: url.trim() })}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://"
            size="lg"
            type="url"
            value={url}
          />
        </div>
        <Button
          disabled={isCapturing || !url.trim()}
          onClick={() => void capture()}
          title={screen.image ? RECAPTURE_HINT : undefined}
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
        <div className="review-screen-editor__body">
          <div className="review-screen-editor__shot">
            <ReviewMarkupToolbar
              canClear={marks.length > 0}
              canOrderPins={canOrderPins}
              canRedo={history.canRedo}
              canUndo={history.canUndo}
              onClear={markup.clearMarks}
              onOrderPins={() => step({ pins: orderPins(pins, readingPinIds) })}
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
              // A phone capture is drawn no wider than a large phone (420px),
              // as on the review page; pins are fractions of this box, so
              // they stay on what they mark.
              className={`relative touch-none select-none overflow-hidden rounded-md border border-white/10 ${
                screen.viewport === "mobile" ? "max-w-phone" : ""
              } ${markup.cursor}`}
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
              onPointerDown={markup.startMark}
              onPointerMove={markup.shapeMark}
              onPointerUp={markup.finishMark}
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
                draft={markup.draft}
                height={screen.image.height}
                marks={markup.shown}
                onSelect={markup.onMarkClick}
                selected={markup.selectedMark}
                width={screen.image.width}
              />
              {markup.editing ? (
                <MarkEditLayer
                  height={screen.image.height}
                  mark={markup.editing}
                  onChange={markup.setPreview}
                  onCommit={markup.commitEdit}
                  surface={imageRef}
                  width={screen.image.width}
                />
              ) : null}
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
            brandDoc={brandDoc}
            conceptLimit={conceptLimit}
            firstNumber={firstNumber}
            image={screen.image}
            onRemove={removePin}
            onReorder={(ids) => step({ pins: orderPins(pins, ids) })}
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
        <Label>About this screen (optional)</Label>
        <PageEditor
          onChange={(note) => patch({ note: note as RichText })}
          value={toEditorDoc(screen.note)}
        />
      </div>
    </div>
  );
}
