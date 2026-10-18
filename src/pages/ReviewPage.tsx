import "./ReviewPage.css";
import { type CSSProperties, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  isRichTextEmpty,
  type RichText,
  type TextBlock,
  textToBlocks,
} from "../../config/proposal.js";
import {
  PIN_KINDS,
  PIN_LABELS,
  type ReviewScreen,
} from "../../config/review.js";
import { PageContent } from "../cms/PageContent";
import {
  ReviewMarks,
  reviewAccentStyle,
} from "../components/review/ReviewMarkup";
import { type ReviewRecord, reviewsApi } from "../services/reviewService";
import { siteConfig } from "../site";
import { useSiteSettings } from "../theme/SiteSettingsProvider";
import { formatDate } from "./ProposalAcceptance";
import { ReviewPdfButton } from "./ReviewPdfButton";
import { LOGO_PATH, LOGO_TRANSFORM, LOGO_VIEW_BOX } from "./siteLogo";

/**
 * A site review as the client reads it: the opening, the headline
 * findings, then each screen as its screenshot with numbered pins beside
 * the numbered notes. Numbers run on across screens, so "note 14" means the
 * same thing in the email, on the page and in the PDF.
 */
export function ReviewPage() {
  const { slug = "" } = useParams();
  const { settings } = useSiteSettings();
  const [review, setReview] = useState<ReviewRecord | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">(
    "loading"
  );

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    void (async () => {
      try {
        const record = await reviewsApi.get(slug);
        if (!cancelled) {
          setReview(record);
          setState("ready");
        }
      } catch {
        if (!cancelled) {
          setState("missing");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (review) {
      document.title = `${review.title} — ${settings.ownerName}`;
    }
  }, [review, settings.ownerName]);

  return (
    <div
      className="page review-page"
      style={reviewAccentStyle(settings.theme.accent)}
    >
      <header className="page__body review-page__masthead">
        <Link className="review-page__wordmark" to="/">
          <svg
            aria-hidden
            className="review-page__logo"
            fill="currentColor"
            height={20}
            viewBox={LOGO_VIEW_BOX}
            width={20}
          >
            <title>{settings.ownerName}</title>
            <g transform={LOGO_TRANSFORM}>
              <path d={LOGO_PATH} />
            </g>
          </svg>
          {settings.ownerName}
        </Link>
        <span className="review-page__masthead-end">
          <span className="label label--quiet">Site review</span>
          {state === "ready" && review ? (
            <ReviewPdfButton slug={review.slug} />
          ) : null}
        </span>
      </header>

      <main className="page__body review-page__main">
        {state === "loading" && <p className="label label--quiet">Loading</p>}
        {state === "missing" && (
          <div className="stack">
            <h1 className="review-page__notice-title">Review not found</h1>
            <p className="review-page__prose">
              This link may have expired or the review has been withdrawn.
            </p>
          </div>
        )}
        {state === "ready" && review && (
          <ReviewSheet ownerName={settings.ownerName} review={review} />
        )}
      </main>

      <footer className="hairline review-page__footer">
        <p className="label label--quiet">
          © {new Date().getFullYear()} {settings.ownerName}
        </p>
      </footer>
    </div>
  );
}

function ReviewSheet({
  review,
  ownerName,
}: {
  review: ReviewRecord;
  ownerName: string;
}) {
  const { doc } = review;
  const screens = doc.screens.filter((s) => s.image);
  const firstNumbers: number[] = [];
  let n = 1;
  for (const screen of screens) {
    firstNumbers.push(n);
    n += screen.pins.length;
  }
  const total = n - 1;

  return (
    <article className="review-page__sheet">
      <header className="stack stack--tight">
        <p className="label review-page__kicker">
          Site review · {formatDate(review.updatedAt)} · {screens.length}{" "}
          {screens.length === 1 ? "screen" : "screens"} · {total}{" "}
          {total === 1 ? "note" : "notes"}
        </p>
        <h1 className="review-page__title">{review.title}</h1>
        {review.status === "draft" && (
          <p className="label review-page__draft">
            Draft — only visible to signed-in admins
          </p>
        )}
      </header>

      <div className="review-page__parties">
        <dl className="review-page__party">
          <dt className="label">Prepared for</dt>
          <dd>{review.clientName || "—"}</dd>
          {review.brand ? (
            <>
              <dt className="label">Company</dt>
              <dd>{review.brand.name}</dd>
            </>
          ) : null}
          {screens[0]?.sourceUrl ? (
            <>
              <dt className="label">Site</dt>
              <dd>
                <a href={screens[0].sourceUrl} rel="noreferrer" target="_blank">
                  {hostOf(screens[0].sourceUrl)}
                </a>
              </dd>
            </>
          ) : null}
        </dl>
        <dl className="review-page__party">
          <dt className="label">Reviewer</dt>
          <dd>{ownerName}</dd>
          <dt className="label">Practice</dt>
          <dd>
            {siteConfig.tagline}, {siteConfig.domain}
          </dd>
          <dt className="label">Notes</dt>
          <dd>
            <span className="review-page__legend">
              {PIN_KINDS.map((kind) => (
                <span
                  className={`review-page__legend-item review-page__legend-item--${kind}`}
                  key={kind}
                >
                  {PIN_LABELS[kind]}
                </span>
              ))}
            </span>
          </dd>
        </dl>
      </div>

      {isRichTextEmpty(doc.intro) ? null : (
        <div className="review-page__intro">
          <Prose text={doc.intro} />
        </div>
      )}

      {isRichTextEmpty(doc.summary) ? null : (
        <section className="review-page__section">
          <h2 className="review-page__section-title">Headline findings</h2>
          <Prose text={doc.summary} />
        </section>
      )}

      <Recommendations firstNumbers={firstNumbers} screens={screens} />

      {screens.map((screen, i) => (
        <Screen
          firstNumber={firstNumbers[i] ?? 1}
          key={screen.id}
          last={i === screens.length - 1 && isRichTextEmpty(doc.closing)}
          screen={screen}
        />
      ))}

      {isRichTextEmpty(doc.closing) ? null : (
        <section className="review-page__section review-page__section--last">
          <Prose text={doc.closing} />
        </section>
      )}
    </article>
  );
}

function Screen({
  screen,
  firstNumber,
  last,
}: {
  screen: ReviewScreen;
  firstNumber: number;
  last: boolean;
}) {
  const { image } = screen;
  if (!image) {
    return null;
  }
  const cls = last
    ? "review-page__section review-page__section--screen review-page__section--last"
    : "review-page__section review-page__section--screen";
  const figureCls =
    screen.viewport === "mobile"
      ? "review-page__screen review-page__screen--mobile"
      : "review-page__screen";
  return (
    <section className={cls}>
      <h2 className="review-page__section-title">{screen.title || "Screen"}</h2>
      {screen.sourceUrl ? (
        <p className="review-page__source">
          <a href={screen.sourceUrl} rel="noreferrer" target="_blank">
            {screen.sourceUrl}
          </a>
        </p>
      ) : null}
      {isRichTextEmpty(screen.note) ? null : <Prose text={screen.note} />}
      <div className={figureCls}>
        <figure
          className="review-page__figure"
          style={
            {
              "--shot-ratio": image.width / Math.max(1, image.height),
            } as CSSProperties
          }
        >
          <img
            alt={screen.title}
            className="review-page__image"
            height={image.height}
            src={image.url}
            width={image.width}
          />
          <ReviewMarks
            height={image.height}
            marks={screen.marks}
            width={image.width}
          />
          {screen.pins.map((pin, i) => (
            <span
              className={`review-page__pin review-page__pin--${pin.kind}`}
              key={pin.id}
              style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }}
            >
              {firstNumber + i}
            </span>
          ))}
        </figure>
        <ol className="review-page__notes">
          {screen.pins.map((pin, i) => (
            <li className="review-page__note" key={pin.id}>
              <span
                className={`review-page__note-n review-page__note-n--${pin.kind}`}
              >
                {firstNumber + i}
              </span>
              <div>
                <p className="review-page__note-title">
                  {pin.title || "Note"}
                  <span className="review-page__note-kind">
                    {kindLabel(pin.kind)}
                  </span>
                </p>
                {pin.body ? (
                  <p className="review-page__note-body">{pin.body}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const kindLabel = (kind: ReviewScreen["pins"][number]["kind"]): string =>
  PIN_LABELS[kind];

const hostOf = (url: string): string => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

function Prose({ text }: { text: RichText }) {
  if (typeof text !== "string") {
    return <PageContent doc={text} />;
  }
  return (
    <>
      {textToBlocks(text).map((block, index) => (
        <ProseBlock block={block} key={blockKey(block, index)} />
      ))}
    </>
  );
}

function ProseBlock({ block }: { block: TextBlock }) {
  if (block.kind === "list") {
    return (
      <ul className="review-page__list">
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }
  return <p className="review-page__prose">{block.text}</p>;
}

const blockKey = (block: TextBlock, index: number): string =>
  block.kind === "list"
    ? `list-${index}-${block.items[0] ?? ""}`
    : `p-${index}-${block.text.slice(0, 24)}`;

/**
 * Every recommendation across the review, in one list near the top.
 *
 * The notes stay with their screens; this is the "what to do" a client can
 * act on without reading every screen first. Numbers match the pins.
 */
function Recommendations({
  firstNumbers,
  screens,
}: {
  firstNumbers: number[];
  screens: ReviewScreen[];
}) {
  const items = screens.flatMap((screen, s) =>
    screen.pins
      .map((pin, i) => ({ n: (firstNumbers[s] ?? 1) + i, pin, screen }))
      .filter(({ pin }) => pin.kind === "recommendation")
  );
  if (items.length === 0) {
    return null;
  }
  return (
    <section className="review-page__section">
      <h2 className="review-page__section-title">Recommendations</h2>
      <ol className="review-page__notes">
        {items.map(({ n, pin, screen }) => (
          <li className="review-page__note" key={pin.id}>
            <span className="review-page__note-n review-page__note-n--recommendation">
              {n}
            </span>
            <div>
              <p className="review-page__note-title">
                {pin.title || "Recommendation"}
                <span className="review-page__note-kind">
                  {screen.title || "Screen"}
                </span>
              </p>
              {pin.body ? (
                <p className="review-page__note-body">{pin.body}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
