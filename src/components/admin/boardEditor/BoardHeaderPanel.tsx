import { ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useDraggablePanel } from "../../../boards/hooks/useDraggablePanel";

/**
 * The board's header bar, movable and collapsible.
 *
 * Drag it by the grip to anywhere on screen; double-click the grip to put it
 * back in the top right. Collapse it to just the grip and a button to open
 * it again. Both are remembered in this browser.
 */

const POSITION_KEY = "board-header:position";
const COLLAPSED_KEY = "board-header:collapsed";

const readCollapsed = (): boolean => {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
};

const writeCollapsed = (value: boolean) => {
  try {
    localStorage.setItem(COLLAPSED_KEY, value ? "1" : "0");
  } catch {
    // Remembering is a nicety; collapsing still works without it.
  }
};

export function BoardHeaderPanel({ children }: { children: ReactNode }) {
  const drag = useDraggablePanel(POSITION_KEY);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const ref = useRef<HTMLDivElement>(null);
  const { fit } = drag;

  // Unfolding makes it wider, and a narrower window moves its edge: either can
  // push a moved bar off screen, grip and all, where it can't be reached.
  useLayoutEffect(() => {
    fit(ref.current);
  });
  useEffect(() => {
    const onResize = () => fit(ref.current);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [fit]);

  const toggle = () => {
    setCollapsed((was) => {
      writeCollapsed(!was);
      return !was;
    });
  };

  return (
    <div
      className={[
        "board-panel board-panel--top-right board-header",
        drag.dragging ? "board-header--dragging" : "",
        collapsed ? "board-header--collapsed" : "",
      ].join(" ")}
      ref={ref}
      style={drag.style ? { ...drag.style, right: "auto" } : undefined}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: a pointer drag handle; moving the bar is a mouse nicety and the bar works where it is */}
      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: as above */}
      <span
        className="board-header__grip"
        onDoubleClick={drag.reset}
        title="Drag to move · double-click to reset"
        {...drag.handleProps}
      >
        <GripVertical aria-hidden size={16} />
      </span>
      {collapsed ? null : (
        <div className="board-header__actions">{children}</div>
      )}
      <button
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Show the header" : "Collapse the header"}
        className="board-header__collapse"
        onClick={toggle}
        title={collapsed ? "Show" : "Collapse"}
        type="button"
      >
        {collapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>
    </div>
  );
}
