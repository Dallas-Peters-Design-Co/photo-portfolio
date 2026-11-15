import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { isRichTextEmpty } from "../../config/proposal.js";
import { PIN_KINDS, PIN_LABELS } from "../../config/review.js";
import type { ReviewRecord } from "../services/reviewService";
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

interface Entry {
  id: string;
  label: string;
}

/** The review's parts, in the order the page shows them. */
export const reviewContents = (review: ReviewRecord): Entry[] => {
  const { doc } = review;
  const entries: Entry[] = [{ id: reviewAnchor.overview, label: "Overview" }];
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

/** The part of the page being read: the last one whose top has passed a third of the way down. */
const useCurrent = (ids: string[]): string | null => {
  const [current, setCurrent] = useState<string | null>(ids[0] ?? null);
  const key = ids.join("|");
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` stands for `ids`
  useEffect(() => {
    const els = ids.flatMap((id) => document.getElementById(id) ?? []);
    if (els.length === 0) {
      return;
    }
    const seen = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            seen.add(entry.target.id);
          } else {
            seen.delete(entry.target.id);
          }
        }
        const first = ids.find((id) => seen.has(id));
        if (first) {
          setCurrent(first);
        }
      },
      { rootMargin: "-30% 0px -60% 0px" }
    );
    for (const el of els) {
      observer.observe(el);
    }
    return () => observer.disconnect();
  }, [key]);
  return current;
};

export function ReviewSidebar({
  ownerName,
  review,
}: {
  ownerName: string;
  /** The review once it has loaded; the mark alone until then. */
  review: ReviewRecord | null;
}) {
  const contents = review ? reviewContents(review) : [];
  const current = useCurrent(contents.map((c) => c.id));

  return (
    <aside aria-label="Review" className="review-page__sidebar">
      <Link className="review-page__wordmark" to="/">
        <svg
          aria-hidden
          className="review-page__logo"
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

      {contents.length > 0 ? (
        <nav aria-label="Contents" className="review-nav">
          <ol className="review-nav__list">
            {contents.map((entry, i) => (
              <li key={entry.id}>
                <a
                  aria-current={current === entry.id ? "location" : undefined}
                  className="review-nav__link"
                  href={`#${entry.id}`}
                >
                  <span aria-hidden className="review-nav__key">
                    [{String(i + 1).padStart(2, "0")}]
                  </span>
                  <span className="review-nav__label">{entry.label}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      <div className="review-page__sidebar-end">
        {review ? (
          <div className="review-page__card">
            <p className="review-page__card-kicker">Prepared for</p>
            <p className="review-page__card-title">
              {review.clientName || review.brand?.name || review.title}
            </p>
            <ReviewPdfButton slug={review.slug} />
          </div>
        ) : null}
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
        <p className="review-page__colophon">
          © {new Date().getFullYear()} {ownerName}
        </p>
      </div>
    </aside>
  );
}
