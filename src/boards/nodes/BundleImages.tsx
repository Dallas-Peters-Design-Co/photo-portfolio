import { HugeiconsIcon } from "@hugeicons/react";
import Cancel01Icon from "@hugeicons-pro/core-stroke-standard/Cancel01Icon";
import { type DragEvent, type ReactNode, useRef, useState } from "react";
import { toast } from "sonner";
import { MAX_BUNDLE_HELD } from "../../../config/nodes/bundle.js";
import { portfolioService } from "../../services/portfolioService.js";
import { isImageDrop } from "../drawing/svgToRaster";
import { BOARD_IMAGE_TYPE } from "../itemOutput";

/**
 * Pictures put straight onto a Bundle, without a photo on the board to wire.
 *
 * A Bundle exists to feed a Video node its references, and the references are
 * often files that have no reason to sit on the board at all. So the node
 * takes them itself: a button for the file picker, or files dropped onto the
 * node — and a picture dragged out of another node's results, which is already
 * stored and only needs its address kept.
 *
 * The drop is caught here and stopped. Left to bubble, the board would also
 * place the same files on the canvas where they landed.
 */

const UPLOAD_PREFIX = "boards/uploads";

const isOurDrag = (e: DragEvent): boolean =>
  e.dataTransfer.types.includes("Files") ||
  e.dataTransfer.types.includes(BOARD_IMAGE_TYPE);

export function BundleDropZone({
  children,
  held,
  onHeldChange,
  readOnly,
}: {
  children: (controls: { add: () => void; uploading: number }) => ReactNode;
  held: string[];
  onHeldChange: (images: string[]) => void;
  readOnly: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [over, setOver] = useState(false);
  // The list as it is after the last upload landed, not as it was when the
  // upload began: two drops in quick succession would otherwise each append to
  // the same old list, and the second would erase the first.
  const latest = useRef(held);
  latest.current = held;

  const keep = (urls: string[]) => {
    const next = [...latest.current, ...urls].slice(0, MAX_BUNDLE_HELD);
    latest.current = next;
    onHeldChange(next);
  };

  const upload = async (files: File[]) => {
    const images = files.filter((file) => isImageDrop(file));
    if (images.length === 0) {
      return;
    }
    setUploading((n) => n + images.length);
    const results = await Promise.allSettled(
      images.map((file) =>
        portfolioService.uploadImageFile(file, undefined, UPLOAD_PREFIX)
      )
    );
    setUploading((n) => n - images.length);
    keep(
      results
        .filter((r) => r.status === "fulfilled")
        .map((r) => (r as PromiseFulfilledResult<{ url: string }>).value.url)
    );
    const failed = results.find((r) => r.status === "rejected");
    if (failed) {
      const { reason } = failed as PromiseRejectedResult;
      toast.error(reason instanceof Error ? reason.message : "Upload failed");
    }
  };

  if (readOnly) {
    return <>{children({ add: () => undefined, uploading: 0 })}</>;
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a drop target; the button inside is the keyboard path to the same action
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: same — dropping is a pointer gesture with a button beside it
    <div
      className={`bundle-node__drop${over ? "bundle-node__drop--over" : ""}`}
      onDragLeave={() => setOver(false)}
      onDragOver={(e) => {
        if (!isOurDrag(e)) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "copy";
        setOver(true);
      }}
      onDrop={(e) => {
        if (!isOurDrag(e)) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        const pulled = e.dataTransfer.getData(BOARD_IMAGE_TYPE);
        if (pulled) {
          try {
            const { url } = JSON.parse(pulled) as { url?: unknown };
            if (typeof url === "string" && url) {
              keep([url]);
            }
          } catch {
            // A malformed payload is nothing worth interrupting for.
          }
          return;
        }
        void upload([...e.dataTransfer.files]);
      }}
    >
      <input
        accept="image/*"
        className="bundle-node__file"
        multiple
        onChange={(e) => {
          void upload([...(e.target.files ?? [])]);
          // Cleared so choosing the same file again still fires a change.
          e.target.value = "";
        }}
        ref={input}
        tabIndex={-1}
        type="file"
      />
      {children({ add: () => input.current?.click(), uploading })}
    </div>
  );
}

/** One uploaded picture, with the control that takes it back off. */
export function HeldThumb({
  index,
  onRemove,
  readOnly,
  url,
}: {
  index: number;
  onRemove: () => void;
  readOnly: boolean;
  url: string;
}) {
  return (
    <div className="bundle-node__held">
      <img
        alt=""
        className="bundle-node__thumb"
        decoding="async"
        height={56}
        loading="lazy"
        src={url}
        width={56}
      />
      {readOnly ? null : (
        <button
          aria-label={`Remove uploaded image ${index + 1}`}
          className="bundle-node__remove"
          onClick={onRemove}
          onPointerDown={(e) => e.stopPropagation()}
          type="button"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={10} />
        </button>
      )}
    </div>
  );
}
