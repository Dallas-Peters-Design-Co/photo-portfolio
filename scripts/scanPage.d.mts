import type { SiteScan } from "../config/siteScan.js";

/** What scanPage reads off a rendered page (see scanPage.mjs). */
export declare function scanPage(
  win?: Window
): Omit<SiteScan, "scannedAt" | "url">;
