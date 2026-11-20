import "./ReviewPage.css";
import { type CSSProperties, type ReactNode, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { hasMergeWriteup } from "../../config/brandMerge.js";
import {
  isRichTextEmpty,
  type RichText,
  type TextBlock,
  textToBlocks,
} from "../../config/proposal.js";
import { PIN_LABELS, type ReviewScreen } from "../../config/review.js";
import {
  prioritizedFixes,
  REVIEW_FIX_PRIORITIES,
} from "../../config/reviewPriorities.js";
import { PageDesignView } from "../boards/pages/PageDesignView";
import { PageContent } from "../cms/PageContent";
import { PinWcagLinks } from "../components/review/PinWcagLinks";
import { ReviewConceptPreview } from "../components/review/ReviewConceptPreview";
import {
  ReviewMarks,
  reviewAccentStyle,
} from "../components/review/ReviewMarkup";
import {
  ReviewLockedError,
  type ReviewRecord,
  reviewsApi,
} from "../services/reviewService";
import { siteConfig } from "../site";
import { useSiteSettings } from "../theme/SiteSettingsProvider";
import { formatDate } from "./ProposalAcceptance";
import {
  ClientLayer,
  FeedbackProvider,
  ScreenComments,
} from "./ReviewFeedback";
import { ReviewLock } from "./ReviewLock";
import { ReviewPrintCapture } from "./ReviewPrintCapture";
import { ReviewSidebar, reviewAnchor } from "./ReviewSidebar";

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
  const [state, setState] = useState<
    "loading" | "ready" | "missing" | "locked"
  >("loading");
  const [lockedTitle, setLockedTitle] = useState("");
  // Bumped when the password is right, to load the review it unlocked.
  const [opened, setOpened] = useState(0);

  // `opened` is the reload once the password has been entered.
  // biome-ignore lint/correctness/useExhaustiveDependencies: opened is a reload trigger, not read
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
      } catch (err) {
        if (!cancelled) {
          setLockedTitle(err instanceof ReviewLockedError ? err.title : "");
          setState(err instanceof ReviewLockedError ? "locked" : "missing");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, opened]);

  useEffect(() => {
    if (review) {
      document.title = `${review.title} — ${settings.ownerName}`;
    }
  }, [review, settings.ownerName]);

  return (
    <div
      className="page doc-shell review-page"
      style={reviewAccentStyle(settings.theme)}
    >
      <ReviewSidebar
        ownerName={settings.ownerName}
        review={state === "ready" ? review : null}
      />
      <main className="doc-shell__main review-page__main">
        {state === "loading" && <p className="label label--quiet">Loading</p>}
        {state === "missing" && (
          <div className="stack">
            <h1 className="review-page__notice-title">Review not found</h1>
            <p className="review-page__prose">
              This link may have expired or the review has been withdrawn.
            </p>
          </div>
        )}
        {state === "locked" && (
          <ReviewLock
            onUnlocked={() => setOpened((n) => n + 1)}
            slug={slug}
            title={lockedTitle}
          />
        )}
        {state === "ready" && review && (
          <FeedbackProvider initial={review.feedback} slug={review.slug}>
            <ReviewSheet ownerName={settings.ownerName} review={review} />
          </FeedbackProvider>
        )}
      </main>
    </div>
  );
}

/**
 * The review's companion documents, in the header where they're found: the
 * brand merge writeup and the brand's design system on the docs site. The
 * sidebar box links the writeup too, but a reader looks at the top first.
 */
function ReviewHeaderLinks({ review }: { review: ReviewRecord }) {
  const merge = hasMergeWriteup(review.doc.merge);
  const docs = review.designSystemUrl;
  const pageDesigns = review.doc.screens.filter((screen) => screen.pageDesign);
  const brandGuide =
    review.brandKitId && review.brand
      ? `/admin/brand-kits/${encodeURIComponent(review.brandKitId)}/guide`
      : null;
  if (!(merge || docs || brandGuide || pageDesigns.length > 0)) {
    return null;
  }
  return (
    <nav aria-label="With this review" className="review-page__hero-links">
      {merge ? (
        <Link
          className="review-page__hero-link"
          to={`/review/${review.slug}/merge`}
        >
          Brand merge writeup →
        </Link>
      ) : null}
      {brandGuide ? (
        <Link className="review-page__hero-link" to={brandGuide}>
          Brand guide →
        </Link>
      ) : null}
      {pageDesigns.map((screen) => (
        <a
          className="review-page__hero-link"
          href={`#${reviewAnchor.screen(screen.id)}`}
          key={screen.id}
        >
          Page design: {screen.title || "Untitled"} ↓
        </a>
      ))}
      {docs ? (
        <a
          className="review-page__hero-link"
          href={docs}
          rel="noopener"
          target="_blank"
        >
          Design system docs ↗
        </a>
      ) : null}
    </nav>
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
  const screens = doc.screens.filter(
    (screen) =>
      screen.image ||
      screen.pageDesign ||
      screen.pins.length > 0 ||
      !isRichTextEmpty(screen.note)
  );
  const firstNumbers: number[] = [];
  let n = 1;
  for (const screen of screens) {
    firstNumbers.push(n);
    n += screen.pins.length;
  }
  const total = n - 1;

  return (
    <article className="review-page__sheet">
      <header className="doc-band review-page__hero" id={reviewAnchor.overview}>
        <p className="review-page__kicker">
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
        <ReviewHeaderLinks review={review} />
        <div className="review-page__hero-foot">
          <div className="review-page__intro">
            {isRichTextEmpty(doc.intro) ? null : <Prose text={doc.intro} />}
          </div>
          <dl className="review-page__parties">
            <div className="review-page__party">
              <dt>Prepared for</dt>
              <dd>
                {review.clientName || "—"}
                {review.brand ? `, ${review.brand.name}` : ""}
              </dd>
            </div>
            {screens[0]?.sourceUrl ? (
              <div className="review-page__party">
                <dt>Site</dt>
                <dd>
                  <a
                    href={screens[0].sourceUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {hostOf(screens[0].sourceUrl)}
                  </a>
                </dd>
              </div>
            ) : null}
            <div className="review-page__party">
              <dt>Reviewer</dt>
              <dd>
                {ownerName}, {siteConfig.domain}
              </dd>
            </div>
          </dl>
        </div>
      </header>

      {isRichTextEmpty(doc.summary) ? null : (
        <section className="doc-band doc-band--split" id={reviewAnchor.summary}>
          <h2 className="doc-band__title">Findings</h2>
          <div className="doc-band__body">
            <Prose text={doc.summary} />
          </div>
        </section>
      )}

      <PriorityFixList doc={doc} />

      {doc.sections
        .filter(
          (section) =>
            !isRichTextEmpty(section.body) ||
            (section.recommendations?.length ?? 0) > 0
        )
        .map((section) => (
          <section
            className="doc-band doc-band--split"
            id={reviewAnchor.section(section.id)}
            key={section.id}
          >
            <h2 className="doc-band__title">{section.title || "Section"}</h2>
            <div className="doc-band__body">
              {isRichTextEmpty(section.body) ? null : (
                <Prose text={section.body} />
              )}
              {section.recommendations?.map((recommendation) => (
                <div
                  className="review-page__section-recommendation"
                  id={`review-recommendation-${recommendation.id}`}
                  key={recommendation.id}
                >
                  <h3>{recommendation.title || "Recommendation"}</h3>
                  {isRichTextEmpty(recommendation.body) ? null : (
                    <Prose text={recommendation.body} />
                  )}
                  {recommendation.concepts?.map((concept) => (
                    <ReviewConceptPreview concept={concept} key={concept.id} />
                  ))}
                </div>
              ))}
            </div>
          </section>
        ))}

      {screens.map((screen, i) => (
        <Screen
          firstNumber={firstNumbers[i] ?? 1}
          key={screen.id}
          screen={screen}
        />
      ))}

      {isRichTextEmpty(doc.closing) ? null : (
        <section className="doc-band doc-band--split">
          <h2 className="doc-band__title">Closing</h2>
          <div className="doc-band__body">
            <Prose text={doc.closing} />
          </div>
        </section>
      )}
      <section
        className="doc-band doc-band--split doc-band--last"
        id={reviewAnchor.comments}
      >
        <h2 className="doc-band__title">Comments</h2>
        <div className="doc-band__body">
          <ScreenComments screenId="" />
        </div>
      </section>
    </article>
  );
}

function PriorityFixList({ doc }: { doc: ReviewRecord["doc"] }) {
  const fixes = prioritizedFixes(doc);
  if (fixes.length === 0) {
    return null;
  }

  return (
    <section className="doc-band doc-band--split" id={reviewAnchor.priorities}>
      <h2 className="doc-band__title">Priority fixes</h2>
      <div className="doc-band__body review-page__priority-fixes">
        {REVIEW_FIX_PRIORITIES.map(({ key, label }) => {
          const group = fixes.filter((fix) => fix.priority === key);
          if (group.length === 0) {
            return null;
          }

          return (
            <section
              className="review-page__priority-group"
              data-priority={key}
              key={key}
            >
              <h3>{label}</h3>
              <ol>
                {group.map((fix) => (
                  <li key={fix.id}>
                    <a
                      className="review-page__priority-link"
                      href={`#${fix.anchor}`}
                    >
                      <span className="review-page__priority-number">
                        {fix.label}
                      </span>
                      <span>
                        <strong>{fix.title}</strong>
                        <span className="review-page__priority-screen">
                          {fix.context}
                        </span>
                      </span>
                    </a>
                  </li>
                ))}
              </ol>
            </section>
          );
        })}
      </div>
    </section>
  );
}

const noteId = (pinId: string): string => `note-${pinId}`;

/**
 * A phone capture is shown in a phone: frame, screen, the camera's pill and
 * side buttons. The capture fills the screen to the top, as on a real phone,
 * with the pins drawn above the pill, and scrolls inside the screen.
 * A desktop capture is shown as it is.
 */
function Device({
  children,
  mobile,
}: {
  children: ReactNode;
  mobile: boolean;
}) {
  if (!mobile) {
    return children;
  }
  return (
    <div className="review-page__phone">
      <span
        aria-hidden
        className="review-page__phone-button review-page__phone-button--action"
      />
      <span
        aria-hidden
        className="review-page__phone-button review-page__phone-button--up"
      />
      <span
        aria-hidden
        className="review-page__phone-button review-page__phone-button--down"
      />
      <span
        aria-hidden
        className="review-page__phone-button review-page__phone-button--power"
      />
      <div className="review-page__phone-body">
        <div className="review-page__phone-screen">
          <span aria-hidden className="review-page__phone-island">
            <span className="review-page__phone-camera" />
          </span>
          <div className="review-page__phone-view">{children}</div>
        </div>
      </div>
    </div>
  );
}

function Screen({
  screen,
  firstNumber,
}: {
  screen: ReviewScreen;
  firstNumber: number;
}) {
  const { image } = screen;
  const [shown, setShown] = useState<string | null>(null);
  if (screen.pageDesign) {
    return (
      <section
        className="doc-band review-page__section--screen"
        id={reviewAnchor.screen(screen.id)}
      >
        <h2 className="doc-band__title">{screen.title || "Page"}</h2>
        {isRichTextEmpty(screen.note) ? null : <Prose text={screen.note} />}
        <PageDesignView page={screen.pageDesign}>
          <ClientLayer
            height={screen.pageDesign.height}
            screenId={screen.id}
            width={screen.pageDesign.width}
          />
        </PageDesignView>
        <ScreenComments screenId={screen.id} />
      </section>
    );
  }
  if (!image) {
    if (screen.pins.length === 0 && isRichTextEmpty(screen.note)) {
      return null;
    }
    return (
      <section
        className="doc-band doc-band--split review-page__section--screen"
        id={reviewAnchor.screen(screen.id)}
      >
        <h2 className="doc-band__title">{screen.title || "Screen"}</h2>
        <div className="doc-band__body">
          {isRichTextEmpty(screen.note) ? null : <Prose text={screen.note} />}
          <ol className="review-page__notes">
            {screen.pins.map((pin, i) => (
              <li
                className="review-page__note"
                id={noteId(pin.id)}
                key={pin.id}
              >
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
                  <PinWcagLinks
                    className="review-page__note-wcag"
                    wcag={pin.wcag}
                  />
                  {pin.concepts?.map((concept) => (
                    <ReviewConceptPreview concept={concept} key={concept.id} />
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </div>
        <ScreenComments screenId={screen.id} />
      </section>
    );
  }
  // A pin on the picture brings its note to the top of the window, beside
  // the screenshot, and marks it for a moment so the eye lands on it.
  const showNote = (id: string) => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    document.getElementById(noteId(id))?.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "start",
    });
    setShown(id);
  };
  const hasPrintCapture = screen.pins.length > 0 || screen.marks.length > 0;
  const cls = cn(
    "review-page__screen",
    screen.viewport === "mobile" && "review-page__screen--mobile",
    hasPrintCapture && "review-page__screen--print-capture"
  );
  return (
    <section
      className="doc-band review-page__section--screen"
      id={reviewAnchor.screen(screen.id)}
    >
      <div className="review-page__screen-head">
        <h2 className="doc-band__title">{screen.title || "Screen"}</h2>
        {screen.sourceUrl ? (
          <p className="review-page__source">
            <a href={screen.sourceUrl} rel="noreferrer" target="_blank">
              {screen.sourceUrl}
            </a>
          </p>
        ) : null}
      </div>
      {isRichTextEmpty(screen.note) ? null : <Prose text={screen.note} />}
      {hasPrintCapture ? (
        <ReviewPrintCapture
          image={image}
          mobile={screen.viewport === "mobile"}
          title={`${screen.title || "Screen"} without annotations`}
        />
      ) : null}
      <div className={cls}>
        <Device mobile={screen.viewport === "mobile"}>
          <figure
            className="review-page__figure"
            style={
              {
                "--shot-ratio": image.width / Math.max(1, image.height),
              } as CSSProperties
            }
          >
            {/* The image's full height, so pins and marks are placed on the
                picture, not on the window the figure scrolls it through. */}
            <div className="review-page__canvas">
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
              <ClientLayer
                height={image.height}
                screenId={screen.id}
                width={image.width}
              />
              {screen.pins.map((pin, i) => (
                <button
                  aria-label={`Note ${firstNumber + i}: ${pin.title || "Note"}`}
                  className={`review-page__pin review-page__pin--${pin.kind}`}
                  key={pin.id}
                  onClick={() => showNote(pin.id)}
                  style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }}
                  type="button"
                >
                  {firstNumber + i}
                </button>
              ))}
            </div>
          </figure>
        </Device>
        <ol className="review-page__notes">
          {screen.pins.map((pin, i) => (
            <li
              className={cn(
                "review-page__note",
                shown === pin.id && "review-page__note--shown"
              )}
              id={noteId(pin.id)}
              key={pin.id}
            >
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
                <PinWcagLinks
                  className="review-page__note-wcag"
                  wcag={pin.wcag}
                />
                {pin.concepts?.map((concept) => (
                  <ReviewConceptPreview concept={concept} key={concept.id} />
                ))}
              </div>
            </li>
          ))}
        </ol>
      </div>
      <ScreenComments screenId={screen.id} />
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
