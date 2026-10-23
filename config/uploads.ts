/**
 * What may be uploaded, decided once.
 *
 * There were two lists — one in the browser to fail early with a readable
 * message, one on the server to actually refuse — and a comment on each asking
 * the next person to keep them in step. That is not a mechanism. A type added
 * to one and not the other is an upload that either dies at the handler with a
 * worse message or is turned away by the browser for no reason the server
 * agrees with.
 *
 * In config/ because it is the one place both halves already import from.
 */
export const IMAGE_UPLOAD_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  // SVG, so a vector dropped onto a board can be kept as a vector rather than
  // always being rasterised. Nothing downstream minds: the run endpoint
  // rasterises an SVG the moment a model needs pixels.
  "image/svg+xml",
  /*
   * Photoshop documents, so a PSD can sit on a board as the thing somebody
   * actually works in. The board never renders one — it uploads a flattened
   * PNG beside it and shows that; see src/boards/io/psdPreview.ts — so nothing
   * downstream has to learn a new format.
   *
   * Every spelling browsers use, because they disagree: the type comes from
   * the operating system's own table, and one machine's
   * "image/vnd.adobe.photoshop" is another's "application/x-photoshop".
   */
  "application/x-photoshop",
  "image/vnd.adobe.photoshop",
  "image/x-photoshop",
] as const;

/**
 * Source clips, for a Video node to rework and a Bundle to carry.
 *
 * Kept apart from the pictures because twenty callers upload a picture and
 * expect one back — a portfolio photo, a brand logo, a mask — and none of them
 * can do anything with an mp4. Only the board's clip path asks for these.
 *
 * QuickTime is what a Mac names a screen recording or a phone clip; M4V is the
 * same file under the name iTunes gave it.
 */
export const VIDEO_UPLOAD_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
] as const;

/** Everything the signing handler will accept, of either kind. */
export const UPLOAD_TYPES = [
  ...IMAGE_UPLOAD_TYPES,
  ...VIDEO_UPLOAD_TYPES,
] as const;

/** What to say when a file is turned away. Named formats, not MIME types. */
export const UPLOAD_REFUSAL = "Choose an image, an SVG or a Photoshop file";

export const CLIP_REFUSAL = "Choose an MP4, MOV or WebM clip";

/** Whether a file is a picture this app can take. */
export const isUploadType = (type: string): boolean =>
  (IMAGE_UPLOAD_TYPES as readonly string[]).includes(type);

/** Whether a file is a clip this app can take. */
export const isVideoUploadType = (type: string): boolean =>
  (VIDEO_UPLOAD_TYPES as readonly string[]).includes(type);
