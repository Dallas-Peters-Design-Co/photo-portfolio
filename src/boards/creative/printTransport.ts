import {
  apiBase,
  getAuthToken,
  jsonHeaders,
  uploadPath,
} from "../../services/portfolioService";

/**
 * Getting a big sheet to the print server and its PDF back.
 *
 * A Vercel function takes and returns at most about 4.5 MB, and a poster can
 * be more either way: its HTML (fonts and local pictures copied in) or its
 * PDF (every picture at print size). Past that, both go through Blob
 * storage instead: the browser uploads the HTML and sends its address, and
 * the server answers with the PDF's address. Both files are deleted once
 * they've been read.
 */

/** Sent in the request itself up to here; uploaded first past it. */
const INLINE_MAX = 3_500_000;

/** Where print jobs sit in Blob storage; the server only reads from here. */
export const PRINT_JOBS = "print-jobs";

/** The HTML, as the request carries it: inline, or the address of a copy. */
export const sheetPayload = async (
  html: string
): Promise<{ html: string } | { htmlUrl: string }> => {
  if (html.length <= INLINE_MAX) {
    return { html };
  }
  const token = getAuthToken();
  if (!token) {
    throw new Error("Sign in again to print");
  }
  const { upload } = await import("@vercel/blob/client");
  const blob = await upload(
    `${PRINT_JOBS}/sheet.txt`,
    new Blob([html], { type: "text/plain" }),
    {
      access: "public",
      clientPayload: token,
      contentType: "text/plain",
      handleUploadUrl: uploadPath(),
    }
  );
  return { htmlUrl: blob.url };
};

/** The PDF from the server's answer: the file itself, or fetched from Blob. */
export const pdfFrom = async (res: Response): Promise<Blob> => {
  if (!res.headers.get("Content-Type")?.includes("application/json")) {
    return res.blob();
  }
  const { url } = (await res.json()) as { url?: string };
  if (!url) {
    throw new Error("The print server sent no PDF");
  }
  const got = await fetch(url);
  if (!got.ok) {
    throw new Error("Couldn't fetch the printed PDF");
  }
  const pdf = await got.blob();
  // Tidied away once it's here; a failure only leaves a file behind.
  void fetch(`${apiBase()}/api/boards/print-pdf`, {
    body: JSON.stringify({ done: url }),
    headers: jsonHeaders(),
    method: "POST",
  }).catch(() => undefined);
  return pdf;
};
