import type { Markup } from "./componentSourceParts.js";
import { initialState, stateNames } from "./componentStates.js";
import type { ConceptSlot } from "./conceptSlots.js";

export function componentStateSource(
  group: ConceptSlot,
  bodies: string[],
  css: string,
  childCss: string
): Markup {
  const names = stateNames(group);
  const initial = initialState(group);
  return {
    body: bodies[initial],
    childCss,
    css:
      css +
      "\n& { display:grid; align-content:start; min-width:0; gap:0.5em; } &__selector { justify-self:start; max-width:100%; font:inherit; }",
    tag: "div",
    tsx: (name, cls) => `import { useState } from "react";
import "./${name}.css";

export function ${name}({ className = "" }: { className?: string }) {
  const [active, setActive] = useState(${initial});
  return (
    <div className={["${cls}", className].filter(Boolean).join(" ")}>
      <select aria-label="Component state" className="${cls}__selector" value={active} onChange={(event) => setActive(Number(event.target.value))}>
        {${JSON.stringify(names)}.map((label, index) => <option key={index} value={index}>{label}</option>)}
      </select>
${bodies
  .map(
    (body, index) =>
      body && `      {active === ${index} && (${body.replaceAll("@@", cls)})}`
  )
  .filter(Boolean)
  .join("\n")}
    </div>
  );
}`,
  };
}
