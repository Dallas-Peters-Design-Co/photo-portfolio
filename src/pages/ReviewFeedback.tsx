import {
  type CSSProperties,
  createContext,
  type FormEvent,
  type PointerEvent,
  type ReactNode,
  useContext,
  useRef,
  useState,
} from "react";
import { newItemId } from "../../config/proposal.js";
import type { MarkKind, ReviewMark } from "../../config/review.js";
import type { ReviewFeedback } from "../../config/reviewFeedback.js";
import { ReviewMarks } from "../components/review/ReviewMarkup";
import { reviewsApi } from "../services/reviewService";
import "./ReviewFeedback.css";

/**
 * The client's side of a review: comments, pinned to a spot on a screen if
 * they like, with their own boxes, arrows, highlights and pen strokes drawn
 * on it (config/reviewFeedback.ts).
 *
 * Their markup is drawn in a second colour so it never reads as the
 * designer's, and their pins are lettered (A, B, …) rather than numbered, so
 * "note 4" still only ever means the designer's note 4.
 *
 * One comment is written at a time. Drawing happens on the screenshot while
 * its composer is open; the comment is posted with what was drawn.
 */

type DrawTool = "spot" | MarkKind;

const TOOLS: { id: DrawTool; label: string }[] = [
  { id: "spot", label: "Pin a spot" },
  { id: "box", label: "Box" },
  { id: "arrow", label: "Arrow" },
  { id: "highlight", label: "Highlight" },
  { id: "pen", label: "Pen" },
];

/** The client's markup colour: a blue that stays apart from any site accent. */
export const CLIENT_INK = { "--review-accent": "#2f6fd6" } as CSSProperties;

const AUTHOR_KEY = "review-author";

const savedAuthor = (): string => {
  try {
    return window.localStorage.getItem(AUTHOR_KEY) ?? "";
  } catch {
    return "";
  }
};

const keepAuthor = (name: string) => {
  try {
    window.localStorage.setItem(AUTHOR_KEY, name);
  } catch {
    // Asked again next time.
  }
};

interface Draft {
  marks: ReviewMark[];
  screenId: string;
  tool: DrawTool;
  x: number | null;
  y: number | null;
}

interface FeedbackState {
  /** The comment being written, and what's drawn for it so far. */
  draft: Draft | null;
  feedback: ReviewFeedback[];
  post: (body: string, author: string) => Promise<void>;
  setDraft: (draft: Draft | null) => void;
  slug: string;
}

const Feedback = createContext<FeedbackState | null>(null);

export function FeedbackProvider({
  children,
  initial,
  slug,
}: {
  children: ReactNode;
  initial: ReviewFeedback[];
  slug: string;
}) {
  const [feedback, setFeedback] = useState(initial);
  const [draft, setDraft] = useState<Draft | null>(null);
  const post = async (body: string, author: string) => {
    if (!draft) {
      return;
    }
    const saved = await reviewsApi.comment(slug, {
      author,
      body,
      marks: draft.marks,
      screenId: draft.screenId,
      x: draft.x,
      y: draft.y,
    });
    setFeedback((was) => [...was, saved]);
    setDraft(null);
  };
  return (
    <Feedback.Provider value={{ draft, feedback, post, setDraft, slug }}>
      {children}
    </Feedback.Provider>
  );
}

const useFeedback = () => useContext(Feedback);

/** A, B, … Z, then AA: the client's pins, told apart from the numbered notes. */
const letter = (i: number): string =>
  i < 26
    ? String.fromCharCode(65 + i)
    : `${letter(Math.floor(i / 26) - 1)}${letter(i % 26)}`;

const pinned = (feedback: ReviewFeedback[], screenId: string) =>
  feedback.filter((f) => f.screenId === screenId);

/** The client's markup and pins over a screenshot, and where they draw new ones. */
export function ClientLayer({
  height,
  screenId,
  width,
}: {
  height: number;
  screenId: string;
  width: number;
}) {
  const state = useFeedback();
  const surface = useRef<HTMLDivElement>(null);
  const [drawing, setDrawing] = useState<ReviewMark | null>(null);
  if (!state) {
    return null;
  }
  const mine = pinned(state.feedback, screenId);
  const draft = state.draft?.screenId === screenId ? state.draft : null;
  const marks = [...mine.flatMap((f) => f.marks), ...(draft?.marks ?? [])];

  const at = (e: { clientX: number; clientY: number }) => {
    const rect = surface.current?.getBoundingClientRect();
    return rect?.width && rect.height
      ? {
          x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
          y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
        }
      : null;
  };

  const press = (e: PointerEvent<HTMLDivElement>) => {
    const pos = at(e);
    if (!(draft && pos)) {
      return;
    }
    if (draft.tool === "spot") {
      state.setDraft({ ...draft, x: pos.x, y: pos.y });
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrawing({
      id: newItemId(),
      kind: draft.tool,
      points: [
        [pos.x, pos.y],
        [pos.x, pos.y],
      ],
    });
  };

  const move = (e: PointerEvent<HTMLDivElement>) => {
    const pos = at(e);
    if (!(drawing && pos)) {
      return;
    }
    const point: [number, number] = [pos.x, pos.y];
    setDrawing(
      drawing.kind === "pen"
        ? { ...drawing, points: [...drawing.points, point] }
        : { ...drawing, points: [drawing.points[0] ?? point, point] }
    );
  };

  const release = () => {
    if (drawing && draft) {
      const [a, b] = [drawing.points[0], drawing.points.at(-1)];
      if (a && b && Math.hypot(b[0] - a[0], b[1] - a[1]) > 0.01) {
        state.setDraft({ ...draft, marks: [...draft.marks, drawing] });
      }
    }
    setDrawing(null);
  };

  return (
    <>
      <div className="review-feedback__ink" style={CLIENT_INK}>
        <ReviewMarks
          draft={drawing}
          height={height}
          marks={marks}
          width={width}
        />
      </div>
      {mine.map((f, i) =>
        f.x === null || f.y === null ? null : (
          <span
            className="review-feedback__pin"
            data-resolved={f.resolved ? "" : undefined}
            key={f.id}
            style={{ left: `${f.x * 100}%`, top: `${f.y * 100}%` }}
            title={f.body}
          >
            {letter(i)}
          </span>
        )
      )}
      {draft && draft.x !== null && draft.y !== null ? (
        <span
          className="review-feedback__pin review-feedback__pin--draft"
          style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%` }}
        >
          {letter(mine.length)}
        </span>
      ) : null}
      {draft ? (
        <div
          className="review-feedback__surface"
          data-tool={draft.tool}
          onPointerDown={press}
          onPointerMove={move}
          onPointerUp={release}
          ref={surface}
        />
      ) : null}
    </>
  );
}

/** The client's comments on one screen (or the review, for ""), and the box to add one. */
export function ScreenComments({ screenId }: { screenId: string }) {
  const state = useFeedback();
  if (!state) {
    return null;
  }
  const mine = pinned(state.feedback, screenId);
  const writing = state.draft?.screenId === screenId;
  return (
    <div className="review-feedback">
      {mine.length > 0 ? (
        <ol className="review-feedback__list">
          {mine.map((f, i) => (
            <li
              className="review-feedback__item"
              data-resolved={f.resolved ? "" : undefined}
              key={f.id}
            >
              <span className="review-feedback__badge">{letter(i)}</span>
              <div>
                <p className="review-feedback__meta">
                  {f.author}
                  {f.resolved ? " · resolved" : ""}
                </p>
                {f.body ? (
                  <p className="review-feedback__body">{f.body}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      ) : null}
      {writing ? (
        <Composer />
      ) : (
        <button
          className="review-feedback__open"
          disabled={state.draft !== null}
          onClick={() =>
            state.setDraft({
              marks: [],
              screenId,
              tool: screenId ? "spot" : "box",
              x: null,
              y: null,
            })
          }
          type="button"
        >
          {screenId ? "Comment on this screen" : "Leave a comment"}
        </button>
      )}
    </div>
  );
}

function Composer() {
  const state = useFeedback();
  const [body, setBody] = useState("");
  const [author, setAuthor] = useState(savedAuthor);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!state?.draft) {
    return null;
  }
  const { draft } = state;
  const onScreen = draft.screenId !== "";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      keepAuthor(author);
      await state.post(body, author);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't post that");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="review-feedback__composer" onSubmit={submit}>
      {onScreen ? (
        <div
          aria-label="Draw on the screen"
          className="review-feedback__tools"
          role="toolbar"
        >
          {TOOLS.map((t) => (
            <button
              aria-pressed={draft.tool === t.id}
              className="review-feedback__tool"
              key={t.id}
              onClick={() => state.setDraft({ ...draft, tool: t.id })}
              type="button"
            >
              {t.label}
            </button>
          ))}
          {draft.marks.length > 0 ? (
            <button
              className="review-feedback__tool"
              onClick={() =>
                state.setDraft({ ...draft, marks: draft.marks.slice(0, -1) })
              }
              type="button"
            >
              Undo drawing
            </button>
          ) : null}
        </div>
      ) : null}
      {onScreen ? (
        <p className="review-feedback__hint">
          {draft.tool === "spot"
            ? "Click the screenshot to pin your comment to a spot."
            : "Draw on the screenshot, then write your comment."}
        </p>
      ) : null}
      <textarea
        aria-label="Your comment"
        className="review-feedback__text"
        onChange={(e) => setBody(e.target.value)}
        placeholder="Your comment"
        rows={3}
        value={body}
      />
      <input
        aria-label="Your name"
        className="review-feedback__name"
        onChange={(e) => setAuthor(e.target.value)}
        placeholder="Your name"
        value={author}
      />
      {error ? (
        <p className="review-feedback__error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="review-feedback__actions">
        <button
          className="review-feedback__cancel"
          onClick={() => state.setDraft(null)}
          type="button"
        >
          Cancel
        </button>
        <button
          className="review-feedback__post"
          disabled={busy || !(body.trim() || draft.marks.length > 0)}
          type="submit"
        >
          {busy ? "Posting…" : "Post comment"}
        </button>
      </div>
    </form>
  );
}
