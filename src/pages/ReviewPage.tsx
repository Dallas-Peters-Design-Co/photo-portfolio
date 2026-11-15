import "./ReviewPage.css";
import { type CSSProperties, type ReactNode, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  isRichTextEmpty,
  type RichText,
  type TextBlock,
  textToBlocks,
} from "../../config/proposal.js";
import { PIN_LABELS, type ReviewScreen } from "../../config/review.js";
import { PageContent } from "../cms/PageContent";
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
          <h2 className="doc-band__title">Headline findings</h2>
          <div className="doc-band__body">
            <Prose text={doc.summary} />
          </div>
        </section>
      )}

      {doc.sections
        .filter((section) => !isRichTextEmpty(section.body))
        .map((section) => (
          <section
            className="doc-band doc-band--split"
            id={reviewAnchor.section(section.id)}
            key={section.id}
          >
            <h2 className="doc-band__title">{section.title || "Section"}</h2>
            <div className="doc-band__body">
              <Prose text={section.body} />
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

const noteId = (pinId: string): string => `note-${pinId}`;

/**
 * A phone capture is shown in a phone: a dark body, the camera cut-out in a
 * strip above the screen (so it never covers the capture) and a home bar
 * below. The capture scrolls inside the screen, as the page would. A desktop
 * capture is shown as it is.
 */
function Device({
  children,
  mobile,
}: {
  children: ReactNode;
  mobile: boolean;
}) {
  return mobile ? (
    <div className="review-page__phone">{children}</div>
  ) : (
    children
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
  if (!image) {
    return null;
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
  const cls = "doc-band review-page__section--screen";
  const figureCls =
    screen.viewport === "mobile"
      ? "review-page__screen review-page__screen--mobile"
      : "review-page__screen";
  return (
    <section className={cls} id={reviewAnchor.screen(screen.id)}>
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
      <div className={figureCls}>
        <Device mobile={screen.viewport === "mobile"}>
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
          </figure>
        </Device>
        <ol className="review-page__notes">
          {screen.pins.map((pin, i) => (
            <li
              className={`review-page__note${shown === pin.id ? "review-page__note--shown" : ""}`}
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
