import { domToBlob, waitUntilLoad } from "modern-screenshot";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import type { PageDesign } from "../../../config/pageDesign.js";
import { PageDesignView } from "./PageDesignView";

/** Render the initial prototype state at its authored dimensions, independent
 * of the zoom, selection and playback state of the editor. */
export async function renderPageFrame(
  page: PageDesign,
  maxSide: number
): Promise<Blob> {
  const host = document.createElement("div");
  host.inert = true;
  host.style.cssText = `position:fixed;top:0;left:0;width:${page.width}px;pointer-events:none;z-index:-1`;
  (document.querySelector("[data-board-palette]") ?? document.body).append(
    host
  );
  const root = createRoot(host);
  try {
    flushSync(() => root.render(<PageDesignView page={page} stepIndex={0} />));
    const sheet = host.querySelector<HTMLElement>(".page-design__sheet");
    if (!sheet) {
      throw new Error("Couldn't draw the page for the shader");
    }
    await waitUntilLoad(sheet);
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
    return await domToBlob(sheet, {
      height: page.height,
      scale: Math.min(1, maxSide / Math.max(page.width, page.height)),
      style: { transform: "none" },
      width: page.width,
    });
  } finally {
    root.unmount();
    host.remove();
  }
}
