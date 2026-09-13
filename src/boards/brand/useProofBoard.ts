import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { BrandKitDoc, LogoEntry } from "../../../config/brandKit.js";
import { boardsApi, portfolioService } from "../../services/portfolioService";
import { drawProofSheet, proofBoardTitle, proofItems } from "./buildProofBoard";

/**
 * Making a proof board, from a logo in the kit panel.
 *
 * Two calls rather than one, the same shape copyFrameToBoard uses: boards are
 * created empty and the arrangement follows in the save every board already
 * does. If the second fails the board still exists, empty, which is why the
 * error says so rather than claiming nothing happened.
 *
 * A new board every time, never an update in place. Kits are versioned and a
 * version is never rewritten, so the sheet should behave the same way — a
 * sheet made in March keeps showing March's mark, and the before-and-after is
 * half the value the first time somebody changes a logo.
 */

/**
 * The artwork, rasterised once at a known size.
 *
 * An <img> is not enough, and the reason is specific: an SVG written with
 * `width="100%" height="100%"` — which is what a designer's export tool
 * produces — has no intrinsic size at all. The element reports zero, every
 * canvas built from `mark.width x mark.height` comes out empty, and each tile
 * that recolours the mark draws nothing. That is one bug wearing five masks:
 * the app icon, the knockout, the relief, the cap and the lanyard all went
 * through the same missing number.
 *
 * So the viewBox is read for the aspect and the mark is drawn once into a
 * canvas of real pixels. Everything downstream then has a width and a height
 * it can trust, and none of it needs to know the artwork was ever a vector.
 */
const MARK_PX = 1024;
const SVG_URL = /\.svg(\?|#|$)/i;
const VIEWBOX = /viewBox\s*=\s*"[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)"/i;

/** The aspect an SVG declares, when the element will not say. */
const aspectOf = async (url: string): Promise<number> => {
  if (!SVG_URL.test(url)) {
    return 0;
  }
  try {
    const [, w, h] = VIEWBOX.exec(await (await fetch(url)).text()) ?? [];
    const width = Number(w);
    const height = Number(h);
    return width > 0 && height > 0 ? width / height : 0;
  } catch {
    return 0;
  }
};

const loadMark = async (url: string): Promise<HTMLCanvasElement> => {
  const declared = await aspectOf(url);
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    /*
     * Deliberately asking for CORS here, unlike measureRaster.
     *
     * The opposite call for the opposite reason: this one reads pixels back —
     * every tile draws the mark into a canvas and reads it — and a tainted
     * canvas makes toBlob throw. The blob store serves the header, and a logo
     * adopted into it before the kit version was written is the only kind
     * that reaches here.
     */
    element.crossOrigin = "anonymous";
    element.onload = () => resolve(element);
    element.onerror = () =>
      reject(new Error("That logo could not be loaded to draw from"));
    element.src = url;
  });

  // The element's own size when it has one, the viewBox when it does not, and
  // a square as the last resort — a mark with neither is unusual enough that
  // guessing square is better than refusing to draw it.
  const aspect =
    image.naturalWidth > 0 && image.naturalHeight > 0
      ? image.naturalWidth / image.naturalHeight
      : declared || 1;
  const canvas = document.createElement("canvas");
  canvas.width = aspect >= 1 ? MARK_PX : Math.round(MARK_PX * aspect);
  canvas.height = aspect >= 1 ? Math.round(MARK_PX / aspect) : MARK_PX;
  const ctx = canvas.getContext("2d");
  // Drawn with an explicit size, which is the whole point: an SVG with no
  // intrinsic dimensions draws nothing when asked to draw at its own.
  ctx?.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
};

export const useProofBoard = () => {
  const navigate = useNavigate();

  const makeProofBoard = async (
    kit: { doc: BrandKitDoc; name: string; version: number | null },
    logo: LogoEntry
  ) => {
    const title = proofBoardTitle(kit.name, logo.label, kit.version);
    const toastId = toast.loading("Drawing the proof sheet…");
    try {
      const mark = await loadMark(logo.url);
      const sheet = await drawProofSheet(mark, kit.doc, logo, kit.name);

      toast.loading(`Uploading ${sheet.length} tiles…`, { id: toastId });
      // Together: the bytes go straight to blob storage without touching a
      // function, so fifteen at once is the ordinary case rather than a queue.
      const uploaded = await Promise.all(
        sheet.map(async (tile) => {
          const file = new File([tile.blob], `${tile.label}.png`, {
            type: "image/png",
          });
          const { url } = await portfolioService.uploadImageFile(
            file,
            undefined,
            "boards/proof"
          );
          return { caption: tile.caption, label: tile.label, url };
        })
      );

      const created = await boardsApi.create(title);
      await boardsApi.update(created.id, {
        items: proofItems(uploaded),
        wires: [],
      });

      toast.dismiss(toastId);
      toast.success(`${uploaded.length} tiles on "${title}"`, {
        action: {
          label: "Open",
          onClick: () => navigate(`/admin/boards/${created.id}`),
        },
      });
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(
        err instanceof Error ? err.message : "Could not make a proof board"
      );
    }
  };

  /**
   * The handler for one kit, or nothing when there is nothing to name.
   *
   * The rule lives here rather than at the button: a sheet is titled after the
   * kit version it was drawn against, so a kit with no saved version has no
   * sheet to make — and the panel should not have to know that to decide
   * whether to show a button.
   */
  const proofHandlerFor = (kit: {
    name: string;
    resolvedDoc: BrandKitDoc;
    version: number | null;
    versionId: string | null;
  }): ((logo: LogoEntry) => void) | undefined =>
    kit.versionId
      ? (logo) =>
          void makeProofBoard(
            { doc: kit.resolvedDoc, name: kit.name, version: kit.version },
            logo
          )
      : undefined;

  /**
   * The same sheet, dropped onto the board you are already on.
   *
   * The panel button makes a board because that is where a review starts. A
   * Brand node is the other way round: you are mid-work, the mark is already
   * wired into something, and sending you to a different board to look at it
   * is the interruption. So this returns the items and lets the canvas place
   * them where it likes.
   */
  const proofItemsFor = async (
    kit: { doc: BrandKitDoc; name: string },
    logo: LogoEntry,
    at: { x: number; y: number }
  ) => {
    const mark = await loadMark(logo.url);
    const sheet = await drawProofSheet(mark, kit.doc, logo, kit.name);
    const uploaded = await Promise.all(
      sheet.map(async (tile) => {
        const file = new File([tile.blob], `${tile.label}.png`, {
          type: "image/png",
        });
        const { url } = await portfolioService.uploadImageFile(
          file,
          undefined,
          "boards/proof"
        );
        return { caption: tile.caption, label: tile.label, url };
      })
    );
    return proofItems(uploaded).map((item) => ({
      ...item,
      x: item.x + at.x,
      y: item.y + at.y,
    }));
  };

  return { makeProofBoard, proofHandlerFor, proofItemsFor };
};
