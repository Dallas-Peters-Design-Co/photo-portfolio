import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PresentDeck } from "../boards/present/PresentDeck";
import { slidesOf } from "../boards/present/slides";
import { boardsApi } from "../services/portfolioService";
import { useSiteSettings } from "../theme/SiteSettingsProvider";
import type { Board } from "../types";

/**
 * A published board as a presentation, at /board/:slug/present.
 *
 * The same board the public page shows, read the same way — no
 * authentication, 404 when unpublished — arranged as slides by
 * src/boards/present/slides.ts. Leaving goes back to the board's page.
 */
export function BoardPresentPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { settings } = useSiteSettings();
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      return;
    }
    let cancelled = false;
    void boardsApi.get(slug).then(
      (loaded) => {
        if (!cancelled) {
          setBoard(loaded);
        }
      },
      () => {
        if (!cancelled) {
          setError("This board is not available.");
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (board) {
      document.title = `${board.title} — ${settings.name}`;
    }
  }, [board, settings.name]);

  const slides = useMemo(
    () => (board ? slidesOf(board, settings.name) : []),
    [board, settings.name]
  );

  if (error) {
    return (
      <div className="page board-view-page__error">
        <p className="board-view-page__error-note">{error}</p>
      </div>
    );
  }
  if (!board) {
    return null;
  }
  return (
    <div className="board-fixed">
      <PresentDeck
        onExit={() => navigate(`/board/${slug ?? ""}`)}
        slides={slides}
      />
    </div>
  );
}
