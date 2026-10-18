import {
  apiBase,
  jsonHeaders,
  readPageError,
} from "../services/portfolioService";

/**
 * "Download PDF" for any page the API can print (a proposal, a review): the
 * server prints the page with a real browser and hands the file back, so the
 * PDF follows the page's own print stylesheet with no second layout.
 *
 * The admin token rides along in the headers, so a draft prints too.
 */
export const downloadPagePdf = async (
  endpoint: string,
  filename: string
): Promise<void> => {
  const res = await fetch(`${apiBase()}${endpoint}`, {
    body: JSON.stringify({ origin: window.location.origin }),
    headers: jsonHeaders(),
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(await readPageError(res, "Could not make the PDF"));
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

export const reviewPdfFilename = (slug: string): string => `review-${slug}.pdf`;

export const downloadReviewPdf = (slug: string): Promise<void> =>
  downloadPagePdf(
    `/api/reviews/${encodeURIComponent(slug)}/pdf`,
    reviewPdfFilename(slug)
  );
