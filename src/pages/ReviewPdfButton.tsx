import { useState } from "react";
import { downloadReviewPdf } from "./pagePdf";

/**
 * "Download PDF" on the review page. The server prints this very page, so it
 * takes a few seconds; the button says so rather than looking stuck.
 */
export function ReviewPdfButton({ slug }: { slug: string }) {
  const [isRendering, setIsRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    if (isRendering) {
      return;
    }
    setIsRendering(true);
    setError(null);
    try {
      await downloadReviewPdf(slug);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not make the PDF");
    } finally {
      setIsRendering(false);
    }
  };

  return (
    <span className="review-page__pdf-wrap">
      <button
        className="review-page__pdf"
        disabled={isRendering}
        onClick={() => void download()}
        type="button"
      >
        {isRendering ? "Preparing PDF…" : "Download PDF"}
      </button>
      {error ? (
        <span className="review-page__pdf-error" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}
