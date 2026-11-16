import { useEffect } from "react";
import type { FontId } from "../../../config/theme.js";
import { loadFont } from "../../theme/fonts";
import { loadFontRef } from "../../theme/remoteFonts";

/**
 * Loads the typeface an element or concept is set in: a brand font (Google,
 * Fontshare, Adobe) or one of the app's own (Exposure, and the rest). Called
 * where it is drawn, so every place that draws one has its face, rather
 * than each place remembering to load it — the editor's preview loaded
 * only brand fonts, and an app font like Exposure fell back.
 */
export const useConceptFont = (
  family: string,
  fontRef?: string,
  fontId?: string
): void => {
  useEffect(() => {
    if (family === "brand" && fontRef) {
      loadFontRef(fontRef);
    }
    if (family === "app" && fontId) {
      void loadFont(fontId as FontId);
    }
  }, [family, fontId, fontRef]);
};
