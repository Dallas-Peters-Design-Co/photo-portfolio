import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  FullScreenIcon,
  PauseIcon,
  PlayIcon,
} from "@hugeicons-pro/core-stroke-standard";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Slide } from "./slides";
import "./PresentDeck.css";

/**
 * A board, presented.
 *
 * Full screen, black, one slide at a time: the board's title, then each
 * frame as a section card followed by its pictures. Arrow keys, space, a
 * click on either half of the screen or a swipe move through it; F goes
 * full screen, P plays it by itself, Escape leaves. The cursor hides after
 * a moment still, because a cursor over a cover is a cursor over a cover.
 *
 * The chrome is a thin caption along the bottom — section, caption, count —
 * and a progress line under it. Nothing else: the pictures are the show.
 */

/** How long a slide holds when the deck plays itself. */
const AUTOPLAY_MS = 5000;
/** How long the cursor may rest before it hides. */
const CURSOR_REST_MS = 2000;
const SWIPE_DISTANCE = 56;

export interface PresentDeckProps {
  onExit: () => void;
  slides: Slide[];
}

export function PresentDeck({ slides, onExit }: PresentDeckProps) {
  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [idle, setIdle] = useState(false);
  const count = slides.length;
  const slide = slides[at];

  const go = useCallback(
    (to: number) => setAt(Math.max(0, Math.min(count - 1, to))),
    [count]
  );
  const step = useCallback((by: number) => go(at + by), [at, go]);

  // The keys. On the window so they work before anything has been clicked.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      switch (event.key) {
        case "Escape":
          onExit();
          break;
        case "ArrowRight":
        case " ":
        case "PageDown":
          event.preventDefault();
          step(1);
          break;
        case "ArrowLeft":
        case "PageUp":
          event.preventDefault();
          step(-1);
          break;
        case "Home":
          go(0);
          break;
        case "End":
          go(count - 1);
          break;
        case "f":
        case "F":
          void toggleFullscreen();
          break;
        case "p":
        case "P":
          setPlaying((was) => !was);
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count, go, onExit, step]);

  // Playing by itself: hold, advance, stop at the end.
  useEffect(() => {
    if (!playing) {
      return;
    }
    if (at >= count - 1) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => setAt((was) => was + 1), AUTOPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [at, count, playing]);

  // The cursor, hidden once it rests.
  const rest = useRef<number | null>(null);
  const onMove = useCallback(() => {
    setIdle(false);
    if (rest.current !== null) {
      window.clearTimeout(rest.current);
    }
    rest.current = window.setTimeout(() => setIdle(true), CURSOR_REST_MS);
  }, []);
  useEffect(() => {
    onMove();
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (rest.current !== null) {
        window.clearTimeout(rest.current);
      }
    };
  }, [onMove]);

  // The next picture, fetched while this one is looked at.
  useEffect(() => {
    const next = slides[at + 1];
    if (next?.kind === "picture" && !next.video) {
      new Image().src = next.url;
    }
  }, [at, slides]);

  if (!slide) {
    return (
      <div className="present">
        <p className="present__empty">Nothing framed on this board yet.</p>
      </div>
    );
  }

  const progress = count > 1 ? at / (count - 1) : 1;

  return (
    <div className={idle ? "present present--idle" : "present"}>
      <AnimatePresence mode="wait">
        <motion.div
          animate={{ opacity: 1, scale: 1 }}
          className="present__slide"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.15}
          dragMomentum={false}
          exit={{ opacity: 0, scale: 0.995 }}
          initial={{ opacity: 0, scale: 1.01 }}
          key={at}
          onDragEnd={(_event, info) => {
            if (info.offset.x < -SWIPE_DISTANCE) {
              step(1);
            } else if (info.offset.x > SWIPE_DISTANCE) {
              step(-1);
            }
          }}
          transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
        >
          {slide.kind === "title" ? (
            <div className="present__card">
              <h1 className="present__title">{slide.title}</h1>
              {slide.subtitle ? (
                <p className="present__subtitle">{slide.subtitle}</p>
              ) : null}
            </div>
          ) : null}
          {slide.kind === "section" ? (
            <div className="present__card">
              <h2 className="present__section">{slide.title}</h2>
              <p className="present__subtitle">
                {slide.count} {slide.count === 1 ? "piece" : "pieces"}
              </p>
            </div>
          ) : null}
          {slide.kind === "picture" ? <Picture slide={slide} /> : null}
        </motion.div>
      </AnimatePresence>

      {/* Either half of the screen is a page turn; the chrome sits above. */}
      <button
        aria-label="Previous"
        className="present__half present__half--prev"
        onClick={() => step(-1)}
        type="button"
      />
      <button
        aria-label="Next"
        className="present__half present__half--next"
        onClick={() => step(1)}
        type="button"
      />

      <footer className="present__bar">
        <span className="present__caption">
          {slide.kind === "picture" ? (
            <>
              <span className="present__where">{slide.section}</span>
              {slide.caption ? (
                <span className="present__what">{slide.caption}</span>
              ) : null}
              <span className="present__count">
                {slide.index} / {slide.count}
              </span>
            </>
          ) : null}
        </span>
        <span className="present__actions">
          <button
            aria-label="Previous"
            className="present__button"
            onClick={() => step(-1)}
            type="button"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={18} />
          </button>
          <button
            aria-label="Next"
            className="present__button"
            onClick={() => step(1)}
            type="button"
          >
            <HugeiconsIcon icon={ArrowRight01Icon} size={18} />
          </button>
          <button
            aria-label={playing ? "Pause" : "Play"}
            aria-pressed={playing}
            className="present__button"
            onClick={() => setPlaying((was) => !was)}
            type="button"
          >
            <HugeiconsIcon icon={playing ? PauseIcon : PlayIcon} size={18} />
          </button>
          <button
            aria-label="Full screen"
            className="present__button"
            onClick={() => void toggleFullscreen()}
            type="button"
          >
            <HugeiconsIcon icon={FullScreenIcon} size={18} />
          </button>
          <button
            aria-label="Leave the presentation"
            className="present__button"
            onClick={onExit}
            type="button"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={18} />
          </button>
        </span>
      </footer>
      <div
        aria-hidden
        className="present__progress"
        style={{ transform: `scaleX(${progress})` }}
      />
    </div>
  );
}

/** A picture slide: a clip plays itself, silently; a still is fitted. */
function Picture({ slide }: { slide: Extract<Slide, { kind: "picture" }> }) {
  if (slide.video) {
    return (
      <video
        autoPlay
        className="present__picture"
        loop
        muted
        playsInline
        src={slide.url}
      />
    );
  }
  return (
    // biome-ignore lint/correctness/useImageSize: the slide is the window; the picture is fitted into it whatever its size
    <img
      alt={slide.caption ?? slide.section}
      className="present__picture"
      draggable={false}
      src={slide.url}
    />
  );
}

const toggleFullscreen = async (): Promise<void> => {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  } catch {
    // Refused (an iframe, a browser without it): the deck is fine unfullscreened.
  }
};
