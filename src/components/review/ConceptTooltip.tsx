import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { conceptFontStack } from "../../../config/conceptFont.js";
import { shadowCss } from "../../../config/conceptShadow.js";
import type { ConceptTooltip as TooltipConfig } from "../../../config/conceptTooltip.js";
import { useConceptFont } from "./useConceptFont";
import "./ConceptTooltip.css";

const tooltipBoundaryOf = (anchor: HTMLElement): HTMLElement =>
  anchor.closest<HTMLElement>("[data-tooltip-boundary], .concept-canvas") ??
  anchor.parentElement ??
  anchor;

/** Keep the popup inside its preview frame and translate to trigger coordinates. */
const position = (
  anchor: DOMRect,
  bubble: DOMRect,
  boundary: DOMRect,
  side: TooltipConfig["side"]
): CSSProperties => {
  const gap = 6;
  const inset = 4;
  let x = anchor.left + (anchor.width - bubble.width) / 2;
  let y = anchor.top - bubble.height - gap;
  if (side === "bottom") {
    y = anchor.bottom + gap;
  }
  if (side === "left" || side === "right") {
    x = side === "left" ? anchor.left - bubble.width - gap : anchor.right + gap;
    y = anchor.top + (anchor.height - bubble.height) / 2;
  }
  if (y < boundary.top + inset) {
    y = anchor.bottom + gap;
  }
  if (y + bubble.height > boundary.bottom - inset) {
    y = anchor.top - bubble.height - gap;
  }
  x = Math.max(
    boundary.left + inset,
    Math.min(x, boundary.right - bubble.width - inset)
  );
  y = Math.max(
    boundary.top + inset,
    Math.min(y, boundary.bottom - bubble.height - inset)
  );
  return {
    left: x - anchor.left,
    maxHeight: Math.max(0, boundary.height - inset * 2),
    maxWidth: Math.max(0, boundary.width - inset * 2),
    top: y - anchor.top,
  };
};

/** A tooltip anchors to a component and stays inside its preview frame. */
export function ConceptTooltip({
  children,
  fill = false,
  fullHeight,
  tooltip,
}: {
  children: ReactNode;
  fill?: boolean;
  fullHeight?: boolean;
  tooltip?: TooltipConfig;
}) {
  useConceptFont(
    tooltip?.look.fontFamily ?? "sans",
    tooltip?.look.fontRef,
    tooltip?.look.fontId
  );
  const id = useId();
  const anchor = useRef<HTMLDivElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [where, setWhere] = useState<CSSProperties>({ visibility: "hidden" });
  const visible =
    Boolean(tooltip?.text.trim()) &&
    (!tooltip?.interactive || hovered || focused);
  useLayoutEffect(() => {
    if (!(visible && anchor.current && bubble.current && tooltip)) {
      return;
    }
    const update = () => {
      if (anchor.current && bubble.current) {
        const boundary = tooltipBoundaryOf(anchor.current);
        setWhere(
          position(
            anchor.current.getBoundingClientRect(),
            bubble.current.getBoundingClientRect(),
            boundary.getBoundingClientRect(),
            tooltip.side
          )
        );
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(anchor.current);
    observer.observe(bubble.current);
    observer.observe(tooltipBoundaryOf(anchor.current));
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [visible, tooltip]);
  useEffect(() => {
    if (!(visible && tooltip?.interactive)) {
      return;
    }
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setHovered(false);
        setFocused(false);
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [visible, tooltip?.interactive]);
  if (!tooltip?.text.trim()) {
    return children;
  }
  const { look } = tooltip;
  return (
    <>
      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: hover and focus reveal descriptive text on any component */}
      {/* biome-ignore lint/a11y/useSemanticElements: a fieldset changes the layout and form semantics of arbitrary components */}
      <div
        aria-describedby={visible ? id : undefined}
        className="concept-tooltip__trigger"
        data-fill={fill || undefined}
        data-full-height={fullHeight || undefined}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setFocused(false);
          }
        }}
        onFocus={() => setFocused(true)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        ref={anchor}
        role="group"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: static components need keyboard focus to expose their tooltip
        tabIndex={0}
      >
        {children}
        {visible ? (
          <div
            className="concept-tooltip__bubble concept-tooltip__positioner"
            data-side={tooltip.side}
            id={id}
            ref={bubble}
            role="tooltip"
            style={{
              ...where,
              background: look.background,
              border: look.borderColor
                ? `${look.borderWidth ?? 1}px solid ${look.borderColor}`
                : undefined,
              borderRadius: look.radius,
              boxShadow: look.shadow ? shadowCss(look.shadow) : undefined,
              color: look.color,
              fontFamily: conceptFontStack(
                look.fontFamily,
                look.fontRef,
                look.fontId
              ),
              fontSize: look.fontSize,
              fontWeight: look.fontWeight,
              lineHeight: look.lineHeight,
              padding: `${look.paddingY}px ${look.paddingX}px`,
            }}
          >
            {tooltip.text}
          </div>
        ) : null}
      </div>
    </>
  );
}
