import { Pipette } from "lucide-react";
import { useRef, useState } from "react";
import type { BoardItem } from "../../types";
import { isSvgUrl } from "../io/svgRaster";
import { currentImageUrl } from "../itemOutput";
import { SvgColours } from "../panels/SvgColours";

/**
 * "Colours" for a picture layer that's an SVG: the colours it's drawn in,
 * changed here in the frame editor (panels/SvgColours.tsx does the work).
 * Answers "should I exist" itself, so the bar gains no branch.
 *
 * The panel is placed on the window, under the button: the bar scrolls
 * sideways and would clip anything hung inside it.
 */
export function SvgColoursButton({ item }: { item: BoardItem }) {
  const button = useRef<HTMLButtonElement>(null);
  const [at, setAt] = useState<{ left: number; top: number } | null>(null);
  const url = currentImageUrl(item);
  if (!(url && isSvgUrl(url))) {
    return null;
  }
  const toggle = () => {
    const box = button.current?.getBoundingClientRect();
    setAt((was) =>
      was || !box ? null : { left: box.left, top: box.bottom + 6 }
    );
  };
  return (
    <>
      <button
        aria-expanded={at !== null}
        className="creative__icon creative__icon--label"
        onClick={toggle}
        ref={button}
        title="Change the colours this SVG is drawn in"
        type="button"
      >
        <Pipette size={15} /> Colours
      </button>
      {at ? (
        <div className="creative__popover" style={at}>
          <SvgColours itemId={item.id} onClose={() => setAt(null)} url={url} />
        </div>
      ) : null}
    </>
  );
}
