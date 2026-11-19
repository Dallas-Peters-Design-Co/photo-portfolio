import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { conceptFontStack } from "../../../config/conceptFont.js";
import { shadowCss } from "../../../config/conceptShadow.js";
import type { ConceptTooltip as TooltipConfig } from "../../../config/conceptTooltip.js";
import { useConceptFont } from "./useConceptFont";
import "./ConceptTooltip.css";

/** Position the popup in the viewport, where the concept's clipping can't cut it off. */
const position = (
  anchor: DOMRect,
  bubble: DOMRect,
  side: TooltipConfig["side"]
): CSSProperties => {
  const gap = 6;
  let x = anchor.left + (anchor.width - bubble.width) / 2;
  let y = anchor.top - bubble.height - gap;
  if (side === "bottom") {
    y = anchor.bottom + gap;
  }
  if (side === "left" || side === "right") {
    x = side === "left" ? anchor.left - bubble.width - gap : anchor.right + gap;
    y = anchor.top + (anchor.height - bubble.height) / 2;
  }
  return {
    left: Math.max(4, Math.min(x, window.innerWidth - bubble.width - 4)),
    top: Math.max(4, Math.min(y, window.innerHeight - bubble.height - 4)),
  };
};

/** A tooltip anchors to any component and escapes the preview's clipping. */
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
        setWhere(
          position(
            anchor.current.getBoundingClientRect(),
            bubble.current.getBoundingClientRect(),
            tooltip.side
          )
        );
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(anchor.current);
    observer.observe(bubble.current);
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
      </div>
      {visible
        ? createPortal(
            <div
              className="concept-tooltip__bubble concept-tooltip__positioner"
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
            </div>,
            document.body
          )
        : null}
    </>
  );
}
