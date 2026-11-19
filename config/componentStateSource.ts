import type { Draw, Markup } from "./componentSourceParts.js";
import { stateLabel } from "./componentStates.js";
import type { ConceptSlot } from "./conceptSlots.js";

export function componentStateSource(group: ConceptSlot, draw: Draw): Markup {
  const children = group.elements.map((el, i) =>
    draw(el, `@@__state-${i + 1}`)
  );
  const names = group.elements.map(stateLabel);
  return {
    body: children[0]?.jsx,
    childCss: children.map((c) => c.css).join("\n"),
    css: "& {display:grid; min-width:0; gap:0.5em;} &__choices {display:flex; gap:0.75em; flex-wrap:wrap;} &__choices > button[aria-pressed=true] {text-decoration:underline;}",
    tag: "div",
    tsx: (name, cls) => `import { useState } from "react";
import "./${name}.css";

export function ${name}({ className = "" }: { className?: string }) {
  const [active, setActive] = useState(0);
  return (
    <div className={["${cls}", className].filter(Boolean).join(" ")}>
      <fieldset aria-label="Component states" className="${cls}__choices">
        {${JSON.stringify(names)}.map((label, index) => (
          <button type="button" key={index} aria-pressed={index === active} onClick={() => setActive(index)}>{label}</button>
        ))}
      </fieldset>
${children.map((child, index) => `      {active === ${index} && (${child.jsx.replaceAll("@@", cls)})}`).join("\n")}
    </div>
  );
}`,
  };
}
