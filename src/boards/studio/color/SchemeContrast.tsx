import { useState } from "react";
import { contrastRatio } from "../../../../config/theme.js";

export function SchemeContrast({
  colors,
  labels,
}: {
  colors: string[];
  labels: string[];
}) {
  const [foreground, setForeground] = useState("0");
  const [background, setBackground] = useState("#ffffff");
  const choices = [
    ...colors.map((hex, i) => ({
      hex,
      id: String(i),
      label: `${labels[i]} · ${hex}`,
    })),
    { hex: "#ffffff", id: "#ffffff", label: "White" },
    { hex: "#000000", id: "#000000", label: "Black" },
  ];
  const fg = choices.find((c) => c.id === foreground) ?? choices[0];
  const bg = choices.find((c) => c.id === background) ?? choices[colors.length];
  const ratio = contrastRatio(fg.hex, bg.hex);
  const options = choices.map((c) => (
    <option key={c.id} value={c.id}>
      {c.label}
    </option>
  ));
  return (
    <details className="studio-scheme__contrast">
      <summary>Check contrast</summary>
      <div className="studio-scheme__checks">
        <label className="studio__field">
          Foreground
          <select
            aria-label="Foreground"
            onChange={(e) => setForeground(e.target.value)}
            value={fg.id}
          >
            {options}
          </select>
        </label>
        <label className="studio__field">
          Background
          <select
            aria-label="Background"
            onChange={(e) => setBackground(e.target.value)}
            value={bg.id}
          >
            {options}
          </select>
        </label>
        <span
          className="studio-scheme__sample"
          style={{ backgroundColor: bg.hex, color: fg.hex }}
        >
          Sample text
        </span>
        <output aria-live="polite">
          {ratio.toFixed(2)}:1 · WCAG AA
          <br />
          Normal text (4.5:1) · {ratio >= 4.5 ? "Pass" : "Fail"}
          <br />
          Large text (3:1) · {ratio >= 3 ? "Pass" : "Fail"}
        </output>
      </div>
    </details>
  );
}
