import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { type MemberBoard, sharingApi } from "../../services/sharingService";
import "./MemberBoards.css";

/**
 * What a member sees once signed in: the boards shared with them, and what
 * they may do on each. A viewer opens the board as published, with comments;
 * an editor opens it in the editor.
 */
export function MemberBoards() {
  const [boards, setBoards] = useState<MemberBoard[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    sharingApi
      .memberBoards()
      .then(setBoards)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Could not load your boards")
      );
  }, []);

  if (error) {
    return <p className="member-boards__note">{error}</p>;
  }
  if (!boards) {
    return <p className="member-boards__note">Loading your boards…</p>;
  }
  if (boards.length === 0) {
    return (
      <p className="member-boards__note">No boards are shared with you yet.</p>
    );
  }
  return (
    <section className="member-boards">
      <h2 className="member-boards__title">Boards shared with you</h2>
      <ul className="member-boards__list">
        {boards.map((board) => (
          <li key={board.id}>
            <Link
              className="member-boards__item"
              to={
                board.access === "editor"
                  ? `/admin/boards/${board.id}`
                  : `/board/${board.id}`
              }
            >
              {board.coverUrl ? (
                <img
                  alt=""
                  className="member-boards__cover"
                  height={120}
                  src={board.coverUrl}
                  width={180}
                />
              ) : (
                <span className="member-boards__cover" />
              )}
              <span className="member-boards__name">{board.title}</span>
              <span className="member-boards__access">
                {board.access === "editor"
                  ? "Can edit"
                  : "Can view and comment"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
