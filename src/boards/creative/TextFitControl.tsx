import type { BoardItem } from "../../types";
import { type TextFit, textFitOf } from "./textFit";

const CHOICES: { label: string; title: string; value: TextFit }[] = [
  {
    label: "Fixed",
    title: "The box stays the size you drew it",
    value: "fixed",
  },
  {
    label: "Fit height",
    title: "Keep the width; the box grows and shrinks to the lines",
    value: "height",
  },
  {
    label: "Fit text",
    title: "The box hugs the text both ways, a line per paragraph",
    value: "both",
  },
];

/** How a text box is sized: as drawn, or fitted to its words (textFit.ts). */
export function TextFitControl({
  item,
  onPatch,
}: {
  item: BoardItem;
  onPatch: (patch: Partial<BoardItem>) => void;
}) {
  const fit = textFitOf(item);
  return (
    <span className="creative__field">
      <span>Box</span>
      <span className="creative-fit">
        {CHOICES.map((c) => (
          <button
            aria-pressed={fit === c.value}
            className="creative-fit__option"
            key={c.value}
            onClick={() =>
              onPatch({
                config: {
                  ...(item.config ?? {}),
                  autosize: c.value === "fixed" ? null : c.value,
                },
              })
            }
            title={c.title}
            type="button"
          >
            {c.label}
          </button>
        ))}
      </span>
    </span>
  );
}
