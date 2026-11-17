import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  type BrandMerge,
  hasMergeWriteup,
  type MergeOption,
} from "../../config/brandMerge.js";
import { reviewAccentStyle } from "../components/review/ReviewMarkup";
import {
  ReviewLockedError,
  type ReviewRecord,
  reviewsApi,
} from "../services/reviewService";
import { useSiteSettings } from "../theme/SiteSettingsProvider";
import type { DocEntry } from "./DocShell";
import { ReviewLock } from "./ReviewLock";
import { ReviewSidebar } from "./ReviewSidebar";
import "./ReviewPage.css";
import "./ReviewMergePage.css";

/**
 * A review's brand merge writeup, at /review/:slug/merge, behind the
 * review's own password (the same pass unlocks both pages).
 *
 * Laid out as a case study: the title large, a hero picture, the overview
 * beside what's being presented, the two brands side by side, then each
 * option with its picture, and the recommendation set apart at the end.
 */

const optionAnchor = (i: number) => `option-${i + 1}`;

const mergeContents = (merge: BrandMerge): DocEntry[] => [
  { id: "overview", label: "Overview" },
  ...(merge.brands || merge.comparison.length > 0
    ? [{ id: "brands", label: "The two brands" }]
    : []),
  ...merge.options.map((option, i) => ({
    id: optionAnchor(i),
    label: option.name,
  })),
  ...(merge.recommendation
    ? [{ id: "recommendation", label: "Recommendation" }]
    : []),
];

const PARAGRAPH_BREAK = /\n{2,}/;

const paragraphs = (text: string) =>
  text
    .split(PARAGRAPH_BREAK)
    .map((p) => p.trim())
    .filter(Boolean);

function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {paragraphs(text).map((p) => (
        <p className="merge-page__prose" key={p}>
          {p}
        </p>
      ))}
    </>
  );
}

function DashList({ items, label }: { items: string[]; label: string }) {
  if (items.length === 0) {
    return null;
  }
  return (
    <div className="merge-page__list-block">
      <p className="merge-page__label">{label}</p>
      <ul className="merge-page__dashes">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function Brands({ merge }: { merge: BrandMerge }) {
  const { brands } = merge;
  return (
    <section className="merge-page__band" id="brands">
      <p className="merge-page__label">The two brands</p>
      {brands ? (
        <div className="merge-page__pair">
          {brands.map((brand) => (
            <article className="merge-page__brand" key={brand.name}>
              <h2 className="merge-page__brand-name">{brand.name}</h2>
              <p className="merge-page__prose">{brand.summary}</p>
              <dl className="merge-page__facts">
                <dt>Voice</dt>
                <dd>{brand.voice}</dd>
                <dt>Audience</dt>
                <dd>{brand.audience}</dd>
              </dl>
            </article>
          ))}
        </div>
      ) : null}
      {merge.comparison.length > 0 ? (
        <table className="merge-page__table">
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">Aspect</span>
              </th>
              <th scope="col">{brands?.[0].name ?? "Brand A"}</th>
              <th scope="col">{brands?.[1].name ?? "Brand B"}</th>
              <th scope="col">What it means</th>
            </tr>
          </thead>
          <tbody>
            {merge.comparison.map((row) => (
              <tr key={row.aspect}>
                <th scope="row">{row.aspect}</th>
                <td>{row.a}</td>
                <td>{row.b}</td>
                <td>{row.takeaway}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}

function Option({ index, option }: { index: number; option: MergeOption }) {
  return (
    <article className="merge-page__option" id={optionAnchor(index)}>
      <header className="merge-page__option-head">
        <span className="merge-page__number">
          {String(index + 1).padStart(2, "0")}
        </span>
        <h2 className="merge-page__option-name">{option.name}</h2>
      </header>
      {option.image ? (
        <img
          alt={`${option.name}, shown`}
          className="merge-page__picture"
          height={option.image.height}
          loading="lazy"
          src={option.image.url}
          width={option.image.width}
        />
      ) : null}
      <div className="merge-page__split">
        <div>
          {option.summary ? (
            <p className="merge-page__lede">{option.summary}</p>
          ) : null}
          <Paragraphs text={option.how} />
          {option.when ? (
            <p className="merge-page__when">
              <span className="merge-page__label">Right when</span>
              {option.when}
            </p>
          ) : null}
        </div>
        <div>
          <DashList items={option.keeps} label="Keeps" />
          <DashList items={option.changes} label="Changes" />
          <DashList items={option.risks} label="Risks" />
        </div>
      </div>
    </article>
  );
}

function Writeup({ review }: { review: ReviewRecord }) {
  const merge = review.doc.merge as BrandMerge;
  const title =
    merge.title ||
    (merge.brands
      ?.map((brand) => brand.name)
      .filter(Boolean)
      .join(" + ") ??
      "");
  const year = new Date(merge.generatedAt ?? review.updatedAt).getFullYear();
  return (
    <>
      <header className="merge-page__head">
        <Link className="merge-page__back" to={`/review/${review.slug}`}>
          ← The review
        </Link>
        <h1 className="merge-page__title">{title}.</h1>
        <p className="merge-page__meta">
          Brand merge / {review.clientName || review.title} / {year}
          <span className="merge-page__accent">
            {merge.options.length} option{merge.options.length === 1 ? "" : "s"}
          </span>
        </p>
      </header>

      {merge.hero ? (
        <img
          alt=""
          className="merge-page__cover"
          height={merge.hero.height}
          src={merge.hero.url}
          width={merge.hero.width}
        />
      ) : null}

      <section className="merge-page__band merge-page__split" id="overview">
        <div>
          <p className="merge-page__label">Overview</p>
          <Paragraphs text={merge.overview} />
          {merge.outcome ? (
            <p className="merge-page__outcome">{merge.outcome}</p>
          ) : null}
        </div>
        <div>
          <p className="merge-page__label">Options presented</p>
          <ul className="merge-page__dashes merge-page__dashes--ruled">
            {merge.options.map((option, i) => (
              <li key={option.name}>
                <a href={`#${optionAnchor(i)}`}>{option.name}</a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Brands merge={merge} />

      <section className="merge-page__band" id="options">
        <p className="merge-page__label">Options</p>
        {merge.options.map((option, i) => (
          <Option index={i} key={option.name} option={option} />
        ))}
      </section>

      {merge.recommendation ? (
        <section
          className="merge-page__band merge-page__recommendation"
          id="recommendation"
        >
          <p className="merge-page__label">Recommendation</p>
          <figure>
            <blockquote className="merge-page__quote">
              {merge.recommendation.why}
            </blockquote>
            <figcaption className="merge-page__accent">
              {merge.recommendation.option}
            </figcaption>
          </figure>
        </section>
      ) : null}

      <nav className="merge-page__next">
        <Link to={`/review/${review.slug}`}>
          <span className="merge-page__label">Previous</span>
          <span className="merge-page__next-title">The review</span>
        </Link>
      </nav>
    </>
  );
}

type PageState = "loading" | "ready" | "missing" | "locked";

interface LoadResult {
  /** Set only when the load failed. */
  lockedTitle?: string;
  /** Set only when the review loaded. */
  record?: ReviewRecord;
  state: Exclude<PageState, "loading">;
}

const loadMerge = async (slug: string): Promise<LoadResult> => {
  try {
    const record = await reviewsApi.get(slug);
    return {
      record,
      state: hasMergeWriteup(record.doc.merge) ? "ready" : "missing",
    };
  } catch (err) {
    if (err instanceof ReviewLockedError) {
      return { lockedTitle: err.title, state: "locked" };
    }
    return { lockedTitle: "", state: "missing" };
  }
};

export function ReviewMergePage() {
  const { slug = "" } = useParams();
  const { settings } = useSiteSettings();
  const [review, setReview] = useState<ReviewRecord | null>(null);
  const [state, setState] = useState<PageState>("loading");
  const [lockedTitle, setLockedTitle] = useState("");
  const [opened, setOpened] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: opened is a reload trigger, not read
  useEffect(() => {
    let cancelled = false;
    setState("loading");
    void (async () => {
      const result = await loadMerge(slug);
      if (cancelled) {
        return;
      }
      if (result.record) {
        setReview(result.record);
      }
      if (result.lockedTitle !== undefined) {
        setLockedTitle(result.lockedTitle);
      }
      setState(result.state);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, opened]);

  useEffect(() => {
    const title = review?.doc.merge?.title;
    if (title) {
      document.title = `${title} — ${settings.ownerName}`;
    }
  }, [review, settings.ownerName]);

  const ready = state === "ready" && review;
  return (
    <div
      className="page doc-shell review-page merge-page"
      style={reviewAccentStyle(settings.theme)}
    >
      <ReviewSidebar
        contents={
          ready && review.doc.merge ? mergeContents(review.doc.merge) : []
        }
        onMerge
        ownerName={settings.ownerName}
        review={ready ? review : null}
      />
      <main className="doc-shell__main merge-page__main">
        {state === "loading" && <p className="label label--quiet">Loading</p>}
        {state === "missing" && (
          <div className="stack">
            <h1 className="review-page__notice-title">Nothing here yet</h1>
            <p className="review-page__prose">
              This writeup may not be ready, or the link may have changed.
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
        {ready ? <Writeup review={review} /> : null}
      </main>
    </div>
  );
}
