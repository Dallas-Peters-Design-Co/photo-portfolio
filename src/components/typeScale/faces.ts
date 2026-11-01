import type { TypefaceEntry } from "../../../config/brandKit.js";
import { facesOf, familyOf } from "../../../config/designMd.js";
import type { TypeStyle } from "../../../config/typeScale.js";

/** A kit's headline and body faces, as the type scale's styles name them. */

export interface Faces {
  body?: TypefaceEntry;
  headline?: TypefaceEntry;
}

export const facesFor = (typefaces: TypefaceEntry[]): Faces =>
  facesOf(typefaces);

/** The CSS font stack for a style's face. */
export const familyFor = (faces: Faces, face: TypeStyle["face"]) => {
  const f = face === "headline" ? faces.headline : faces.body;
  return f ? `"${familyOf(f)}", var(--font-sans, system-ui)` : undefined;
};
