import { useEffect, useState } from "react";

/**
 * Whether a logo is drawn in light or dark ink, so the guide shows it once,
 * on the ground it was made for, instead of on three grounds where two make
 * it unreadable.
 *
 * Read from the picture: its opaque pixels' average lightness. The file name
 * ("white", "on-dark", "reversed") answers first, while it loads, and when
 * the picture can't be read.
 */

export type LogoTone = "dark" | "light";

const LIGHT_NAME = /white|light|on-?dark|reverse|inverse|knockout/i;

export const toneFromName = (label: string, url: string): LogoTone =>
  LIGHT_NAME.test(`${label} ${url}`) ? "light" : "dark";

/** Average lightness (0–1) of the visible pixels, or null when there are none. */
export const lightnessOf = (pixels: Uint8ClampedArray): number | null => {
  let sum = 0;
  let weight = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const a = (pixels[i + 3] ?? 0) / 255;
    if (a < 0.2) {
      continue;
    }
    const r = pixels[i] ?? 0;
    const g = pixels[i + 1] ?? 0;
    const b = pixels[i + 2] ?? 0;
    sum += ((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255) * a;
    weight += a;
  }
  return weight > 0 ? sum / weight : null;
};

const readTone = async (url: string): Promise<LogoTone | null> => {
  const res = await fetch(url, { mode: "cors" });
  const blob = await res.blob();
  const local = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = local;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 96;
    canvas.height = Math.max(
      1,
      Math.round((96 * (img.naturalHeight || 96)) / (img.naturalWidth || 96))
    );
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return null;
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const light = lightnessOf(
      ctx.getImageData(0, 0, canvas.width, canvas.height).data
    );
    if (light === null) {
      return null;
    }
    return light > 0.6 ? "light" : "dark";
  } finally {
    URL.revokeObjectURL(local);
  }
};

export const useLogoTone = (label: string, url: string): LogoTone => {
  const [tone, setTone] = useState<LogoTone>(() => toneFromName(label, url));
  useEffect(() => {
    let alive = true;
    readTone(url)
      .then((found) => alive && found && setTone(found))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [url]);
  return tone;
};
