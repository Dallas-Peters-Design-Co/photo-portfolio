/**
 * Shrinks an oversized photograph before it is uploaded.
 *
 * Vercel's image optimizer gives up on very large originals and passes the file
 * through untouched. Two 10,000 px, 59 MB PNG book covers did exactly that: the
 * homepage hero was a 60 MB download every visit. Nothing the site shows is
 * wider than 2,048 px, so 5,000 px on the long side leaves room for any screen
 * and any crop while staying well inside what the optimizer handles.
 *
 * Only JPEG, PNG and WebP are touched (GIFs may be animated, SVGs are vectors,
 * PSDs are working files). The result is WebP at high quality, which keeps
 * transparency. Anything already within limits is returned as is.
 */
const MAX_EDGE = 5000;
const MAX_BYTES = 15 * 1024 * 1024;
const QUALITY = 0.92;
const RASTER = new Set(["image/jpeg", "image/png", "image/webp"]);
const EXTENSION = /\.[a-z0-9]+$/i;

const naturalSize = (file: File): Promise<{ width: number; height: number }> =>
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

export const downscaleForWeb = async (file: File): Promise<File> => {
  if (!RASTER.has(file.type)) {
    return file;
  }
  const { width, height } = await naturalSize(file);
  const longEdge = Math.max(width, height);
  if (longEdge <= MAX_EDGE && file.size <= MAX_BYTES) {
    return file;
  }
  const scale = Math.min(1, MAX_EDGE / longEdge);
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  // Decoded straight to the target size, so a 10,000 px original never sits in
  // memory at full resolution.
  const bitmap = await createImageBitmap(file, {
    resizeHeight: h,
    resizeQuality: "high",
    resizeWidth: w,
  });
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", QUALITY)
  );
  if (!blob) {
    return file;
  }
  // A browser without a WebP encoder hands back PNG; name the file for what it
  // actually is.
  const extension = blob.type === "image/webp" ? "webp" : "png";
  const name = `${file.name.replace(EXTENSION, "") || "image"}.${extension}`;
  return new File([blob], name, {
    lastModified: file.lastModified,
    type: blob.type || "image/png",
  });
};
