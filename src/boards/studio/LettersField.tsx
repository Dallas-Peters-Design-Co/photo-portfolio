import { RotateCcw, X } from "lucide-react";
import { ColorWell } from "../ColorWell";

/**
 * A colour for each letter of the text: every letter has its own well, so
 * the 2 can be blue and the 7 orange. A letter left alone keeps the type
 * colours. Kept as a comma list in step with the text, one entry per letter
 * (empty where it keeps the type colours); an entry may also hold several
 * colours joined by "|", which the tool draws from in turn.
 */

/** A space shown as a dot, so it can be found. */
const shown = (ch: string): string => (ch === " " ? "·" : ch);

/** No colour of its own: the well shows see-through. */
const NONE = "#00000000";

export function LettersField({
  label,
  onChange,
  text,
  value,
}: {
  label: string;
  onChange: (next: string) => void;
  text: string;
  value: string;
}) {
  const chars = [...text];
  const entries = value.split(",");
  const set = (i: number, colour: string) => {
    const next = chars.map((_, k) => entries[k] ?? "");
    next[i] = colour;
    // Trailing blanks are dropped so an untouched text stores nothing.
    while (next.length > 0 && !next.at(-1)) {
      next.pop();
    }
    onChange(next.join(","));
  };
  const any = entries.some((c) => c.trim());
  // Lines of letters, each keeping its place in the text.
  const lines: { ch: string; i: number }[][] = [[]];
  chars.forEach((ch, i) => {
    if (ch === "\n") {
      lines.push([]);
    } else {
      lines.at(-1)?.push({ ch, i });
    }
  });
  return (
    <div className="studio__field studio-letters">
      <span>{label}</span>
      <div className="studio-letters__body">
        {lines.map((line, n) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: lines have no identity but their place
          <div className="studio-letters__line" key={n}>
            {line.map(({ ch, i }) => {
              const own = entries[i]?.split("|")[0]?.trim() || "";
              return (
                <div
                  className="studio-letters__cell"
                  data-own={own ? "" : undefined}
                  key={i}
                >
                  <span className="studio-letters__char">{shown(ch)}</span>
                  <ColorWell
                    alpha={false}
                    label={`Letter ${shown(ch)}`}
                    onChange={(c) => set(i, c.slice(0, 7))}
                    value={own || NONE}
                  />
                  {own ? (
                    <button
                      aria-label={`Letter ${shown(ch)} back to the type colours`}
                      className="studio-letters__clear"
                      onClick={() => set(i, "")}
                      title="Back to the type colours"
                      type="button"
                    >
                      <X size={10} />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
        {any ? (
          <div className="studio-letters__line">
            <button
              className="studio__button"
              onClick={() => onChange("")}
              title="Every letter back to the type colours"
              type="button"
            >
              <RotateCcw size={13} /> Reset letters
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
