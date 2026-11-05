import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { ColorsField } from "./ColorsField";

/**
 * Colours for single letters of the text. Set up the colours to paint with
 * (dark to bright, like the type colours), then click the letters they go
 * on: each letter keeps its own set and draws its pixels from it. Clicking a
 * letter that already has those colours puts it back to the type colours;
 * Shift-click picks a letter's colours up to paint with.
 *
 * Kept as a comma list in step with the text, one entry per letter, its
 * colours joined by "|" ("#a|#b|#c,,#d|#e").
 */
const SEP = "|";

/** A space shown as a dot, so it can be found and clicked. */
const shown = (ch: string): string => (ch === " " ? "·" : ch);

const setOf = (entry: string | undefined): string[] =>
  (entry ?? "")
    .split(SEP)
    .map((c) => c.trim())
    .filter(Boolean);

/** The chip's look: the letter's colours side by side. */
const swatch = (colours: string[]): string | undefined => {
  if (colours.length === 0) {
    return;
  }
  if (colours.length === 1) {
    return colours[0];
  }
  const step = 100 / colours.length;
  const stops = colours.map((c, i) => `${c} ${i * step}% ${(i + 1) * step}%`);
  return `linear-gradient(90deg, ${stops.join(", ")})`;
};

export function LettersField({
  label,
  onChange,
  start,
  text,
  value,
}: {
  label: string;
  onChange: (next: string) => void;
  /** The colours to paint with at first: the tool's type colours. */
  start: string[];
  text: string;
  value: string;
}) {
  const [brush, setBrush] = useState<string[]>(() =>
    start.length > 0 ? start : ["#ffffff"]
  );
  const chars = [...text];
  const entries = value.split(",");
  const brushKey = brush.join(SEP).toLowerCase();
  const set = (i: number, pickUp: boolean) => {
    const own = setOf(entries[i]);
    if (pickUp) {
      if (own.length > 0) {
        setBrush(own);
      }
      return;
    }
    const next = chars.map((_, k) => entries[k] ?? "");
    next[i] = own.join(SEP).toLowerCase() === brushKey ? "" : brush.join(SEP);
    // Trailing blanks are dropped so an untouched text stores nothing.
    while (next.length > 0 && !next.at(-1)) {
      next.pop();
    }
    onChange(next.join(","));
  };
  const any = entries.some((c) => c.trim());
  // Lines of letter buttons, each letter keeping its place in the text.
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
        <ColorsField
          label="Paint with"
          max={5}
          onChange={(next) => setBrush(next.split(",").filter(Boolean))}
          palette={start}
          value={brush}
        />
        {lines.map((line, n) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: lines have no identity but their place
          <div className="studio-letters__line" key={n}>
            {line.map(({ ch, i }) => {
              const own = setOf(entries[i]);
              return (
                <button
                  aria-label={`Letter ${ch}${own.length ? `, ${own.join(" ")}` : ""}`}
                  className="studio-letters__letter"
                  data-own={own.length > 0 || undefined}
                  key={i}
                  onClick={(e) => set(i, e.shiftKey)}
                  style={own.length ? { background: swatch(own) } : undefined}
                  title={
                    own.length
                      ? "Click to repaint (again to put it back) · Shift-click to paint with its colours"
                      : "Paint this letter"
                  }
                  type="button"
                >
                  {shown(ch)}
                </button>
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
