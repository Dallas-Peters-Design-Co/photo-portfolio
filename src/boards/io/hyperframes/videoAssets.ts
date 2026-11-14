import type { ZipFile } from "../../../lib/zip";
import { extOf, fetchBytes } from "../../creative/exportHtml5";
import { OUTLINE_FONTS } from "../../studio/generators/outlineFonts";
import type { StudioValues } from "../../studio/types";

/**
 * The files a HyperFrames project needs in its own folder: HyperFrames
 * renders without the network (and in the cloud, on a machine that has none
 * of this computer's fonts), so fonts and pictures go in `assets/`.
 */

const EXT_AT_END = /(\.[^.]+)?$/;

/** Names in a zip, kept unique: the second `a.woff` is `a-2.woff`. */
export const uniqueName = (taken: Set<string>, name: string): string => {
  let next = name;
  let n = 2;
  while (taken.has(next)) {
    next = name.replace(EXT_AT_END, (ext) => `-${n}${ext}`);
    n += 1;
  }
  taken.add(next);
  return next;
};

const fileName = (url: string) =>
  new URL(url, location.href).pathname.split("/").pop() || "file";

/**
 * The font files a Studio layer draws its type with (a Type Echo, a field
 * shaped by text), copied in, by family and weight, as the runtime wants
 * them.
 */
export const studioFonts = async (
  values: StudioValues[],
  files: ZipFile[],
  taken: Set<string>
): Promise<Record<string, Record<number, string>>> => {
  const families = [
    ...new Set(
      values.map((v) => String(v.font ?? "")).filter((f) => f in OUTLINE_FONTS)
    ),
  ];
  const out: Record<string, Record<number, string>> = {};
  await Promise.all(
    families.map(async (family) => {
      const byWeight = OUTLINE_FONTS[family] ?? {};
      const copied: Record<number, string> = {};
      await Promise.all(
        Object.entries(byWeight).map(async ([weight, url]) => {
          const got = await fetchBytes(new URL(url, location.href).href);
          if (got) {
            const name = uniqueName(taken, `assets/fonts/${fileName(url)}`);
            files.push({ bytes: got.bytes, name });
            copied[Number(weight)] = name;
          }
        })
      );
      if (Object.keys(copied).length > 0) {
        out[family] = copied;
      }
    })
  );
  return out;
};

/** A picture a Studio tool works from, copied in; null if it can't be. */
export const studioPicture = async (
  url: string,
  files: ZipFile[],
  taken: Set<string>
): Promise<string | null> => {
  const got = await fetchBytes(url);
  if (!got) {
    return null;
  }
  const name = uniqueName(
    taken,
    `assets/images/studio.${extOf(url, got.type, "png")}`
  );
  files.push({ bytes: got.bytes, name });
  return name;
};

const FACE = /\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g;
const URL_IN = /url\((["']?)(https:[^"')]+)\1\)/;
const WEIGHT = /font-weight:\s*(\d+)/;

/**
 * Google's stylesheet for the type layers, with the font files copied in:
 * the Latin faces only, at the weights in use (all of them if none match).
 * A sheet that can't be read stays a link.
 */
export const googleFontsLocal = async (
  href: string,
  weights: Set<number>,
  files: ZipFile[],
  taken: Set<string>
): Promise<string | null> => {
  let css: string;
  try {
    const res = await fetch(href);
    if (!res.ok) {
      return null;
    }
    css = await res.text();
  } catch {
    return null;
  }
  const faces = [...css.matchAll(FACE)]
    .filter(([, subset]) => subset === "latin" || subset === "latin-ext")
    .map(([, , face]) => face ?? "");
  const used = faces.filter((f) => weights.has(Number(WEIGHT.exec(f)?.[1])));
  const keep = used.length > 0 ? used : faces;
  const copied = await Promise.all(
    keep.map(async (face) => {
      const url = URL_IN.exec(face)?.[2];
      const got = url ? await fetchBytes(url) : null;
      if (!(url && got)) {
        return null;
      }
      const name = uniqueName(
        taken,
        `assets/fonts/${fileName(url).replace(EXT_AT_END, "")}.${extOf(url, got.type, "woff2")}`
      );
      files.push({ bytes: got.bytes, name });
      return face.replace(URL_IN, `url("${name}")`);
    })
  );
  const done = copied.filter((f): f is string => f !== null);
  return done.length > 0 ? done.join("\n") : null;
};
