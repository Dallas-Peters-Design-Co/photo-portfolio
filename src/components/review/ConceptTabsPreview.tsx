import {
  type CSSProperties,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { ReviewConceptElement } from "../../../config/reviewConcept.js";
import "./ConceptTabsPreview.css";

/** Where the indicator sits: under the active tab, its full width. */
interface Place {
  left: number;
  width: number;
}

/**
 * A row of tabs that can be clicked: the one named by the element's text
 * starts active, and a click moves the indicator to another, sliding and
 * resizing to it. Its look comes through custom properties, each falling
 * back to the old look in the CSS.
 */
export function ConceptTabsPreview({
  element,
  style,
  text,
}: {
  element: ReviewConceptElement;
  style: CSSProperties;
  text: string;
}) {
  const options = element.options ?? [text];
  const [active, setActive] = useState(text);
  const [place, setPlace] = useState<Place | null>(null);
  const row = useRef<HTMLElement>(null);

  // A new starting tab chosen in the editor resets the click.
  useEffect(() => {
    setActive(text);
  }, [text]);

  // Measured after layout, and again whenever the row changes size (a
  // font arriving, the editor narrowing, a tab added), so the line stays
  // under its tab.
  useLayoutEffect(() => {
    const nav = row.current;
    if (!nav) {
      return;
    }
    const measure = () => {
      const tab = [
        ...nav.querySelectorAll<HTMLElement>(".concept-tabs__tab"),
      ].find((button) => button.dataset.option === active);
      setPlace(tab ? { left: tab.offsetLeft, width: tab.offsetWidth } : null);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [active]);

  const look = element.tabLook;
  const vars = {
    ...style,
    "--tab-active": look?.activeColor,
    "--tab-height": look?.height ? `${look.height}px` : undefined,
    "--tab-hover": element.hover?.color,
    "--tab-inactive": look?.inactiveColor,
    "--tab-indicator": look?.indicatorColor,
    "--tab-indicator-size": look?.indicatorSize
      ? `${look.indicatorSize}px`
      : undefined,
    "--tab-padding-x": `${element.paddingX}px`,
    // Side padding belongs to each tab (so the indicator spans it), not the
    // row; the row keeps the top and bottom.
    padding: `${element.paddingY}px 0`,
  } as CSSProperties;
  return (
    <nav
      aria-label="Preview tabs"
      className="concept-tabs"
      ref={row}
      style={vars}
    >
      {options.map((option) => (
        <button
          aria-current={option === active ? "page" : undefined}
          className="concept-tabs__tab"
          data-option={option}
          key={option}
          onClick={() => setActive(option)}
          type="button"
        >
          {option}
        </button>
      ))}
      {place ? (
        <span
          aria-hidden
          className="concept-tabs__indicator"
          style={{
            transform: `translateX(${place.left}px)`,
            width: place.width,
          }}
        />
      ) : null}
    </nav>
  );
}
