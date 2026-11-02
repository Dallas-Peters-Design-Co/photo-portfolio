/**
 * A print-ready PDF from a rendered wrap, with no PDF library.
 *
 * KDP takes a PDF and nothing else for a cover, and a one-page PDF that is a
 * single image is about sixty lines of a format from 1993: a catalog, a page
 * tree, a page, an image XObject and a content stream that draws it. Pulling
 * in a dependency for that would be the larger risk — it is another thing the
 * build has to carry, and this file is easier to read than its docs.
 *
 * The image is stored losslessly (Flate over raw RGB) where the browser can
 * deflate, which every current one can, and as a JPEG at 95 where it cannot.
 * A halftoned, grained cover compresses poorly, so expect tens of megabytes;
 * KDP's ceiling is 650, so that is fine, and lossless is what a print file
 * should be.
 *
 * Page size is the sheet at 300 dpi: pixels ÷ 300 × 72 points. The TrimBox is
 * set one bleed in from the MediaBox, which is how a printer knows where the
 * cut goes; KDP ignores it and uses its own template, but a proof printer
 * will not.
 */

export interface PrintPage {
  /** Inches from the edge of the sheet to the trim. */
  bleedIn: number;
  heightIn: number;
  widthIn: number;
}

const encoder = new TextEncoder();
const bytes = (text: string): Uint8Array => encoder.encode(text);

const concat = (parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};

/** zlib-wrapped deflate, which is what /FlateDecode expects. */
const deflate = async (data: Uint8Array): Promise<Uint8Array | null> => {
  if (typeof CompressionStream === "undefined") {
    return null;
  }
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

const pixelsOf = (
  image: ImageBitmap
): { rgb: Uint8Array; canvas: HTMLCanvasElement } => {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("This browser cannot read the picture back.");
  }
  ctx.drawImage(image, 0, 0);
  const { data } = ctx.getImageData(0, 0, image.width, image.height);
  const rgb = new Uint8Array(image.width * image.height * 3);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
    rgb[j] = data[i];
    rgb[j + 1] = data[i + 1];
    rgb[j + 2] = data[i + 2];
  }
  return { canvas, rgb };
};

const jpegOf = (canvas: HTMLCanvasElement): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("The picture could not be encoded."));
          return;
        }
        blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)), reject);
      },
      "image/jpeg",
      0.95
    );
  });

/**
 * The PDF, as bytes.
 *
 * Object offsets are tracked as the file is assembled, because the xref
 * table at the end has to say where every object starts and a reader that
 * finds it wrong will refuse the file rather than guess.
 */
export const printPdf = async (
  picture: Blob,
  page: PrintPage
): Promise<Blob> => {
  const image = await createImageBitmap(picture);
  const { canvas, rgb } = pixelsOf(image);
  image.close();

  const flate = await deflate(rgb);
  const imageData = flate ?? (await jpegOf(canvas));
  const filter = flate ? "/FlateDecode" : "/DCTDecode";

  const pt = (inches: number) => (inches * 72).toFixed(3);
  const W = pt(page.widthIn);
  const H = pt(page.heightIn);
  const b = pt(page.bleedIn);
  const trimW = pt(page.widthIn - page.bleedIn);
  const trimH = pt(page.heightIn - page.bleedIn);

  const content = bytes(`q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`);

  const objects: Uint8Array[] = [
    bytes("<< /Type /Catalog /Pages 2 0 R >>"),
    bytes("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    bytes(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /BleedBox [0 0 ${W} ${H}] /TrimBox [${b} ${b} ${trimW} ${trimH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`
    ),
    concat([
      bytes(
        `<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter ${filter} /Length ${imageData.length} >>\nstream\n`
      ),
      imageData,
      bytes("\nendstream"),
    ]),
    concat([
      bytes(`<< /Length ${content.length} >>\nstream\n`),
      content,
      bytes("\nendstream"),
    ]),
  ];

  const parts: Uint8Array[] = [bytes("%PDF-1.4\n%âãÏÓ\n")];
  let offset = parts[0].length;
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(offset);
    const head = bytes(`${index + 1} 0 obj\n`);
    const tail = bytes("\nendobj\n");
    parts.push(head, body, tail);
    offset += head.length + body.length + tail.length;
  });

  const xref = [
    "xref",
    `0 ${objects.length + 1}`,
    "0000000000 65535 f ",
    ...offsets.map((o) => `${o.toString().padStart(10, "0")} 00000 n `),
    "trailer",
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    "startxref",
    `${offset}`,
    "%%EOF",
    "",
  ].join("\n");
  parts.push(bytes(xref));

  return new Blob([concat(parts) as BlobPart], { type: "application/pdf" });
};

const saveBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

/**
 * Fetches a rendered wrap and saves it as the print PDF.
 *
 * Built at download time from the stored PNG rather than stored alongside
 * it: the upload route takes pictures only, and a PDF that can be remade from
 * its picture in a second is not worth a second file to keep in sync.
 */
export const downloadPrintPdf = async (
  pictureUrl: string,
  page: PrintPage,
  fileName: string
): Promise<void> => {
  const res = await fetch(pictureUrl);
  if (!res.ok) {
    throw new Error("Could not fetch the rendered wrap.");
  }
  const pdf = await printPdf(await res.blob(), page);
  saveBlob(pdf, fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`);
};
