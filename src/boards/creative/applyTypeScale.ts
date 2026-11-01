import type { BrandKitDoc } from "../../../config/brandKit.js";
import { facesOf } from "../../../config/designMd.js";
import { normalizeTextStyle } from "../../../config/textStyle";
import type { TypeScale, TypeStyle } from "../../../config/typeScale.js";
import type { BoardItem } from "../../types";
import type { Box } from "./creativeModel";
import { rolesOf } from "./roles";

/**
 * The brand's type scale put onto a frame's text: the headline takes the h1
 * (or the biggest heading there is), the body copy takes `body`, the button
 * takes `label`, and any other text takes `body`.
 *
 * Sizes keep the scale's proportions but not its pixels. A web scale's 16px
 * body would be unreadable on a 1080px post, so the whole scale is multiplied
 * up until its body size is the body size this frame wants (4.5% of its short
 * side, as new body text is made). Weight, leading, tracking, case and face
 * come over as they are.
 */

const BODY_SHARE = 0.045;

const pick = (scale: TypeScale, names: string[]): TypeStyle | undefined => {
  for (const name of names) {
    const hit = scale.styles.find((s) => s.name === name);
    if (hit) {
      return hit;
    }
  }
  return undefined;
};

export const applyTypeScale = (
  scale: TypeScale,
  frame: Box,
  layers: BoardItem[],
  doc: BrandKitDoc | null
): Map<string, Partial<BoardItem>> => {
  const out = new Map<string, Partial<BoardItem>>();
  const roles = rolesOf(frame, layers, doc);
  const body = pick(scale, ["body", "lead"]);
  const headline =
    pick(scale, ["h1", "display", "h2"]) ??
    [...scale.styles].sort((a, b) => b.size - a.size)[0];
  const label = pick(scale, ["label", "small", "body"]);
  if (!(body && headline)) {
    return out;
  }
  const factor = (Math.min(frame.width, frame.height) * BODY_SHARE) / body.size;
  const faces = facesOf(doc?.typefaces ?? []);
  const styleFor = (item: BoardItem): TypeStyle => {
    if (item === roles.headline) {
      return headline;
    }
    if (item === roles.cta) {
      return label ?? body;
    }
    return body;
  };
  for (const item of layers) {
    if (!(item.kind === "text" || item.kind === "note")) {
      continue;
    }
    const s = styleFor(item);
    const face = s.face === "headline" ? faces.headline : faces.body;
    out.set(item.id, {
      fontSize: Math.max(8, Math.round(s.size * factor)),
      textStyle: normalizeTextStyle({
        ...(item.textStyle ?? {}),
        family: face?.ref ?? item.textStyle?.family ?? null,
        letterSpacing: s.tracking || null,
        lineHeight: s.lineHeight,
        transform: s.case === "none" ? null : s.case,
        weight: s.weight,
      }),
    });
  }
  return out;
};
