import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { ColorWell } from "../ColorWell";

/**
 * A colour for single letters of the text: pick a colour, then click the
 * letters it goes on. Clicking a letter already in that colour puts it back
 * to the tool's own colours. Kept as a comma list in step with the text.
 */
/** A space shown as a dot, so it can be found and clicked. */
const shown = (ch: string): string => (ch === " " ? "·" : ch);

export function LettersField({
  label,
  onChange,
  palette,
  text,
  value,
}: {
  label: string;
  onChange: (next: string) => void;
  palette: string[];
  text: string;
  value: string;
}) {
  const [brush, setBrush] = useState(palette[0] ?? "#ffffff");
  const chars = [...text];
  const colours = value.split(",");
  const set = (i: number) => {
    const next = chars.map((_, k) => colours[k] ?? "");
    next[i] = next[i]?.toLowerCase() === brush.toLowerCase() ? "" : brush;
    // Trailing blanks are dropped so an untouched text stores nothing.
    while (next.length > 0 && !next.at(-1)) {
      next.pop();
    }
    onChange(next.join(","));
  };
  const any = colours.some((c) => c.trim());
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
        <div className="studio-letters__tools">
          <ColorWell label="Letter colour" onChange={setBrush} value={brush} />
          {any ? (
            <button
              className="studio__button"
              onClick={() => onChange("")}
              title="Every letter back to the type colours"
              type="button"
            >
              <RotateCcw size={13} /> Reset
            </button>
          ) : null}
        </div>
        {lines.map((line, n) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: lines have no identity but their place
          <div className="studio-letters__line" key={n}>
            {line.map(({ ch, i }) => {
              const own = colours[i]?.trim();
              return (
                <button
                  aria-label={`Letter ${ch}${own ? `, ${own}` : ""}`}
                  className="studio-letters__letter"
                  key={i}
                  onClick={() => set(i)}
                  style={own ? { background: own, color: "#000" } : undefined}
                  title={
                    own ? "Click again to put it back" : "Colour this letter"
                  }
                  type="button"
                >
                  {shown(ch)}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
