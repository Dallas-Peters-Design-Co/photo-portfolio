import { type ReactNode, useEffect, useState } from "react";
import "./docShell.css";

/**
 * The frame a document read on the site sits in — a review, a brand guide:
 * a fixed column on the left with the page's mark, its contents numbered and
 * following the reader down the page, and a box of actions; the document
 * beside it in bands (`doc-band`, see docShell.css). One frame, so the pages
 * read alike and change together.
 */

export interface DocEntry {
  id: string;
  label: string;
}

/** The part of the page being read: the first one in the reading band. */
export const useCurrentEntry = (ids: string[]): string | null => {
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

export function DocSidebar({
  card,
  contents,
  foot,
  head,
  label,
}: {
  /** The box near the column's foot: what this is, and its actions. */
  card?: ReactNode;
  contents: DocEntry[];
  /** Below the box: a key, the colophon. */
  foot?: ReactNode;
  /** The column's top: the mark, a way back. */
  head: ReactNode;
  /** Names the column for assistive tech, e.g. "Review". */
  label: string;
}) {
  const current = useCurrentEntry(contents.map((c) => c.id));
  return (
    <aside aria-label={label} className="doc-shell__sidebar">
      <div className="doc-shell__head">{head}</div>
      {contents.length > 0 ? (
        <nav aria-label="Contents" className="doc-nav">
          <ol className="doc-nav__list">
            {contents.map((entry, i) => (
              <li key={entry.id}>
                <a
                  aria-current={current === entry.id ? "location" : undefined}
                  className="doc-nav__link"
                  href={`#${entry.id}`}
                >
                  <span aria-hidden className="doc-nav__key">
                    [{String(i + 1).padStart(2, "0")}]
                  </span>
                  <span className="doc-nav__label">{entry.label}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
      <div className="doc-shell__sidebar-end">
        {card ? <div className="doc-shell__card">{card}</div> : null}
        {foot}
      </div>
    </aside>
  );
}
