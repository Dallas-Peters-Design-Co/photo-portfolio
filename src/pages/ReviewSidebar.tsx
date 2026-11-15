import { Link } from "react-router-dom";
import { isRichTextEmpty } from "../../config/proposal.js";
import { PIN_KINDS, PIN_LABELS } from "../../config/review.js";
import type { ReviewRecord } from "../services/reviewService";
import { type DocEntry, DocSidebar } from "./DocShell";
import { ReviewPdfButton } from "./ReviewPdfButton";
import { LOGO_PATH, LOGO_TRANSFORM, LOGO_VIEW_BOX } from "./siteLogo";

/**
 * The review page's left-hand column: the studio's mark, a numbered contents
 * list that follows the reader down the page, who the review is for with the
 * PDF, and the key to the notes. Fixed beside the review on a wide window;
 * a bar above it on a narrow one. Not printed.
 */

/** The anchor each part of the review is reached by. */
export const reviewAnchor = {
  comments: "review-comments",
  overview: "review-overview",
  recommendations: "review-recommendations",
  screen: (id: string) => `review-screen-${id}`,
  section: (id: string) => `review-section-${id}`,
  summary: "review-summary",
} as const;

/** The review's parts, in the order the page shows them. */
export const reviewContents = (review: ReviewRecord): DocEntry[] => {
  const { doc } = review;
  const entries: DocEntry[] = [
    { id: reviewAnchor.overview, label: "Overview" },
  ];
  if (!isRichTextEmpty(doc.summary)) {
    entries.push({ id: reviewAnchor.summary, label: "Headline findings" });
  }
  for (const section of doc.sections) {
    if (!isRichTextEmpty(section.body)) {
      entries.push({
        id: reviewAnchor.section(section.id),
        label: section.title || "Section",
      });
    }
  }
  const screens = doc.screens.filter((s) => s.image);
  if (screens.some((s) => s.pins.some((p) => p.kind === "recommendation"))) {
    entries.push({
      id: reviewAnchor.recommendations,
      label: "Recommendations",
    });
  }
  for (const screen of screens) {
    entries.push({
      id: reviewAnchor.screen(screen.id),
      label: screen.title || "Screen",
    });
  }
  entries.push({ id: reviewAnchor.comments, label: "Comments" });
  return entries;
};

export function ReviewSidebar({
  ownerName,
  review,
}: {
  ownerName: string;
  /** The review once it has loaded; the mark alone until then. */
  review: ReviewRecord | null;
}) {
  return (
    <DocSidebar
      card={
        review ? (
          <>
            <p className="doc-shell__card-kicker">Prepared for</p>
            <p className="doc-shell__card-title">
              {review.clientName || review.brand?.name || review.title}
            </p>
            <ReviewPdfButton slug={review.slug} />
          </>
        ) : null
      }
      contents={review ? reviewContents(review) : []}
      foot={
        <>
          {review ? (
            <ul aria-label="Kinds of note" className="review-page__legend">
              {PIN_KINDS.map((kind) => (
                <li
                  className={`review-page__legend-item review-page__legend-item--${kind}`}
                  key={kind}
                >
                  {PIN_LABELS[kind]}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="doc-shell__colophon">
            © {new Date().getFullYear()} {ownerName}
          </p>
        </>
      }
      head={
        <Link className="doc-shell__wordmark" to="/">
          <svg
            aria-hidden
            className="doc-shell__logo"
            fill="currentColor"
            height={20}
            viewBox={LOGO_VIEW_BOX}
            width={20}
          >
            <title>{ownerName}</title>
            <g transform={LOGO_TRANSFORM}>
              <path d={LOGO_PATH} />
            </g>
          </svg>
          {ownerName}
        </Link>
      }
      label="Review"
    />
  );
}
