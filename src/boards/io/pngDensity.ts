import { crc32 } from "../../lib/zip";

/**
 * A PNG marked with the density it was drawn for (its pHYs chunk), so an
 * image drawn at twice a frame's size opens in a layout or print tool at the
 * frame's size and twice the detail (144 DPI), rather than as a picture
 * twice as large at 72.
 */

const SIGNATURE = 8;
/** Length, type, 13 bytes of data, CRC. */
const IHDR_END = SIGNATURE + 4 + 4 + 13 + 4;
const INCH_IN_METRES = 0.0254;

/** The pHYs chunk for `dpi` on both axes. */
const physChunk = (dpi: number): Uint8Array<ArrayBuffer> => {
  const perMetre = Math.round(dpi / INCH_IN_METRES);
  const chunk = new Uint8Array(4 + 4 + 9 + 4);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
  view.setUint32(8, perMetre);
  view.setUint32(12, perMetre);
  chunk[16] = 1; // the unit is the metre
  view.setUint32(17, crc32(chunk.subarray(4, 17)));
  return chunk;
};

const isPng = (bytes: Uint8Array): boolean =>
  bytes.length > IHDR_END &&
  bytes[0] === 0x89 &&
  bytes[1] === 0x50 &&
  bytes[12] === 0x49 && // "IHDR"
  bytes[13] === 0x48;

/** The PNG with its density set; anything else comes back as it was. */
export const withDpi = async (png: Blob, dpi: number): Promise<Blob> => {
  const bytes = new Uint8Array(await png.arrayBuffer());
  if (!isPng(bytes)) {
    return png;
  }
  return new Blob(
    [bytes.subarray(0, IHDR_END), physChunk(dpi), bytes.subarray(IHDR_END)],
    { type: "image/png" }
  );
};
