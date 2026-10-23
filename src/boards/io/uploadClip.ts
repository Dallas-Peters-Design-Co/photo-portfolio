import { CLIP_REFUSAL, isVideoUploadType } from "../../../config/uploads.js";
import { apiBase, authStorage } from "../../services/portfolioService";

/**
 * A source clip, sent straight to blob storage.
 *
 * Its own function rather than a branch in uploadImageFile, which twenty
 * callers use to get a picture back and none of them could do anything with an
 * mp4. Only the board asks for this.
 *
 * Multipart, because a clip is routinely hundreds of megabytes where a picture
 * is a few: the transfer goes in parts that retry on their own, rather than as
 * one request that a dropped connection at 90% throws away.
 */
const UNAUTHORIZED = /unauthor/i;

export const uploadClip = async (
  file: File,
  onProgress?: (percent: number) => void
): Promise<{ url: string }> => {
  if (!(file.type && isVideoUploadType(file.type))) {
    throw new Error(CLIP_REFUSAL);
  }
  const token = authStorage.getToken();
  if (!token) {
    throw new Error("Sign in again to upload");
  }
  const { upload } = await import("@vercel/blob/client");
  try {
    const blob = await upload(`boards/clips/${file.name || "clip"}`, file, {
      access: "public",
      // Rides in the payload, as on the picture path: the helper posts to the
      // handler itself and sends no Authorization header.
      clientPayload: token,
      contentType: file.type,
      handleUploadUrl: `${apiBase()}/api/upload`,
      multipart: true,
      onUploadProgress: onProgress
        ? ({ percentage }) => onProgress(Math.round(percentage))
        : undefined,
    });
    return { url: blob.url };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    throw new Error(
      UNAUTHORIZED.test(message)
        ? "Sign in again to upload"
        : `Upload failed: ${message}`,
      { cause: err }
    );
  }
};

/**
 * A clip's own width and height, so it lands on the board the right shape.
 *
 * Read from the file before it is uploaded — the browser decodes only the
 * header for this. Null when it cannot tell, and the caller falls back to a
 * 16:9 box rather than waiting on a file it cannot read.
 */
export const clipSize = (
  file: File
): Promise<{ height: number; width: number } | null> =>
  new Promise((resolve) => {
    const src = URL.createObjectURL(file);
    const video = document.createElement("video");
    const done = (size: { height: number; width: number } | null) => {
      URL.revokeObjectURL(src);
      resolve(size);
    };
    video.preload = "metadata";
    video.muted = true;
    video.onloadedmetadata = () =>
      done(
        video.videoWidth && video.videoHeight
          ? { height: video.videoHeight, width: video.videoWidth }
          : null
      );
    video.onerror = () => done(null);
    video.src = src;
  });
