import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { type SharedPerson, sharingApi } from "../../services/sharingService";
import "./MemberBoards.css";

/**
 * Everyone a board is shared with, and which boards at which level. Sharing
 * is done from the board itself (its Share panel); this is the overview.
 */
export function PeoplePanel() {
  const [people, setPeople] = useState<SharedPerson[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    sharingApi
      .people()
      .then(setPeople)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Could not load people")
      );
  }, []);

  if (error) {
    return <p className="member-boards__note">{error}</p>;
  }
  if (!people) {
    return <p className="member-boards__note">Loading…</p>;
  }
  return (
    <section className="member-boards">
      <h2 className="member-boards__title">People</h2>
      <p className="member-boards__note">
        To add someone, open a board and use Share. They sign in with Google at
        /admin, with the address you shared with.
      </p>
      {people.length === 0 ? (
        <p className="member-boards__note">No boards are shared yet.</p>
      ) : (
        <ul className="people-list">
          {people.map((person) => (
            <li className="people-list__person" key={person.id}>
              <strong>{person.email}</strong>
              {person.boards.length === 0 ? (
                <span className="member-boards__note">No boards</span>
              ) : (
                <ul className="people-list__boards">
                  {person.boards.map((board) => (
                    <li key={board.id}>
                      <Link to={`/admin/boards/${board.id}`}>
                        {board.title}
                      </Link>{" "}
                      <span className="member-boards__note">
                        {board.role === "editor" ? "Editor" : "Viewer"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
