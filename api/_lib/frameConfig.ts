import { cleanPageDesign } from "../../config/pageDesign.js";
import { isSocialPreviewId } from "../../config/socialPreview.js";
import { text } from "./values.js";

/**
 * A frame's config as the save keeps it: whether it is designed, its
 * platform preview, its guides, and its flattened picture. Out of
 * boardItemConfig.ts, which was over the file-size limit.
 */

/** More guides than this on one frame is a mistake, not a layout. */
const MAX_GUIDES = 40;

const guideFractions = (raw: unknown): number[] =>
  Array.isArray(raw)
    ? raw
        .filter(
          (n): n is number =>
            typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1
        )
        .slice(0, MAX_GUIDES)
    : [];

/** A frame's design state, platform preview, and bounded guides. */
export const parseFrameConfig = (
  raw: unknown
): Record<string, unknown> | null => {
  const source = (raw ?? {}) as {
    designed?: unknown;
    pageDesign?: unknown;
    guides?: unknown;
    renderKey?: unknown;
    renderUrl?: unknown;
    socialPreview?: unknown;
  };
  const config: Record<string, unknown> = {};
  const pageDesign = cleanPageDesign(source.pageDesign);
  if (pageDesign) {
    config.pageDesign = pageDesign;
    config.designed = true;
  }
  if (source.designed === true) {
    config.designed = true;
  }
  // The flattened picture of a designed frame and the fingerprint it was
  // drawn at (src/boards/io/frameRender.ts): what a run hands a wired model.
  // Dropped here once, so every save lost it and a run got the frame's loose
  // layers instead — or nothing, and "not a public http(s) URL".
  const renderUrl = text(source.renderUrl, 2000);
  const renderKey = text(source.renderKey, 128);
  if (renderUrl?.startsWith("https://") && renderKey) {
    config.renderUrl = renderUrl;
    config.renderKey = renderKey;
  }
  if (isSocialPreviewId(source.socialPreview)) {
    config.socialPreview = source.socialPreview;
  }
  const guides = (source.guides ?? null) as {
    hideSafe?: unknown;
    x?: unknown;
    y?: unknown;
  } | null;
  if (guides && typeof guides === "object") {
    const x = guideFractions(guides.x);
    const y = guideFractions(guides.y);
    const hideSafe = guides.hideSafe === true;
    if (x.length > 0 || y.length > 0 || hideSafe) {
      config.guides = { hideSafe, x, y };
    }
  }
  return Object.keys(config).length > 0 ? config : null;
};
