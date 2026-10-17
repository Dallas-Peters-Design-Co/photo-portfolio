import { HugeiconsIcon } from "@hugeicons/react";
import { NavLink } from "react-router-dom";
import type { PageSummary } from "../services/portfolioService";
import { iconFrom, useIconMap } from "./useIconMap";
import "./SiteNav.css";

interface SiteNavProps {
  pages: PageSummary[];
  /** Renders links muted over photography, or solid on a plain background. */
}

/**
 * Page links, sitting directly beneath the site wordmark.
 *
 * Renders nothing when there are no published pages, so a site that never adds
 * one looks exactly as it did before the CMS existed.
 */
export function SiteNav({ pages }: SiteNavProps) {
  // The icons arrive in their own chunk; until then each link holds a slot of
  // the icon's size so the row does not shift when they land.
  const icons = useIconMap(pages.some((page) => page.icon));

  if (pages.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Pages" className="site-nav">
      {pages.map((page) => {
        const Icon = iconFrom(icons, page.icon);
        return (
          <NavLink
            // The border stays on the box at all times and only changes
            // color, so the row does not jump by two pixels as you move
            // between pages — dropping the border entirely would reflow it.
            className={({ isActive }) =>
              `site-nav__link ${isActive ? "site-nav__link--current" : ""}`
            }
            key={page.id}
            to={`/${page.slug}`}
          >
            {Icon ? <HugeiconsIcon icon={Icon} size={20} /> : null}
            {!Icon && page.icon && !icons ? (
              <span aria-hidden className="site-nav__icon-slot" />
            ) : null}
            <span className="site-nav__label">
              {page.title}
              <span className="site-nav__rule" />
            </span>
          </NavLink>
        );
      })}
    </nav>
  );
}
