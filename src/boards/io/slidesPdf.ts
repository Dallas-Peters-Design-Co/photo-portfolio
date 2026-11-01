/**
 * A PDF of slides, one picture per page, with no PDF library.
 *
 * The same small format printPdf.ts writes for a cover, with a page per
 * slide. Pages are JPEG at 92: a deck is mailed and opened on phones, so a
 * few megabytes beats a lossless file ten times the size. A page is the
 * slide's pixels at 96 dpi (px × 0.75 points), so 1920×1080 opens at the
 * 20 × 11.25 inch size Keynote and PowerPoint use for 16:9.
 */

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

export interface PdfPage {
  height: number;
  jpeg: Uint8Array;
  width: number;
}

/** A picture re-encoded as JPEG, on white (JPEG has no transparency). */
export const jpegPage = async (picture: Blob): Promise<PdfPage> => {
  const image = await createImageBitmap(picture);
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("This browser can't draw the slides");
  }
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0);
  image.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.92)
  );
  if (!blob) {
    throw new Error("A slide couldn't be encoded");
  }
  return {
    height: canvas.height,
    jpeg: new Uint8Array(await blob.arrayBuffer()),
    width: canvas.width,
  };
};

/**
 * The PDF. Objects are 1 catalog, 2 page tree, then three per page: the
 * page, its image and its content stream.
 */
export const slidesPdf = (pages: PdfPage[]): Blob => {
  const pageObj = (i: number) => 3 + i * 3;
  const objects: Uint8Array[] = [
    bytes("<< /Type /Catalog /Pages 2 0 R >>"),
    bytes(
      `<< /Type /Pages /Kids [${pages.map((_, i) => `${pageObj(i)} 0 R`).join(" ")}] /Count ${pages.length} >>`
    ),
  ];
  pages.forEach((page, i) => {
    const w = (page.width * 0.75).toFixed(2);
    const h = (page.height * 0.75).toFixed(2);
    const content = bytes(`q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`);
    objects.push(
      bytes(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${pageObj(i) + 1} 0 R >> >> /Contents ${pageObj(i) + 2} 0 R >>`
      ),
      concat([
        bytes(
          `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`
        ),
        page.jpeg,
        bytes("\nendstream"),
      ]),
      concat([
        bytes(`<< /Length ${content.length} >>\nstream\n`),
        content,
        bytes("\nendstream"),
      ])
    );
  });

  const parts: Uint8Array[] = [bytes("%PDF-1.4\n%âãÏÓ\n")];
  let offset = parts[0]?.length ?? 0;
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
