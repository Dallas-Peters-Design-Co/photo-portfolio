import type { ComponentSource } from "./componentSource.js";
import { escapeJsx } from "./componentSourceParts.js";
import { conceptFontStack } from "./conceptFont.js";
import { shadowCss } from "./conceptShadow.js";
import type { ConceptTooltip } from "./conceptTooltip.js";

/** Include an attached tooltip in copied React and CSS, as well as the preview. */
export const withTooltipSource = (
  source: ComponentSource,
  tooltip?: ConceptTooltip
): ComponentSource => {
  if (!tooltip?.text.trim()) {
    return source;
  }
  const { className: cls, name } = source;
  const { look } = tooltip;
  const placements = {
    bottom: "top: calc(100% + 6px); left: 50%; transform: translateX(-50%);",
    left: "right: calc(100% + 6px); top: 50%; transform: translateY(-50%);",
    right: "left: calc(100% + 6px); top: 50%; transform: translateY(-50%);",
    top: "bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%);",
  };
  const trigger = `${cls}__with-tooltip`;
  const bubble = `${cls}__tooltip`;
  const base = source.tsx.replace(
    `export function ${name}(`,
    `function ${name}Base(`
  );
  const css = `${source.css}\n\n.${trigger} { position: relative; display: inline-flex; min-width: 0; max-width: 100%; }\n.${bubble} { position: absolute; z-index: 100; ${placements[tooltip.side]} max-width: 20rem; width: max-content; white-space: pre-wrap; overflow-wrap: anywhere; pointer-events: none; background: ${look.background}; color: ${look.color}; border: ${look.borderColor ? `${look.borderWidth ?? 1}px solid ${look.borderColor}` : "none"}; border-radius: ${look.radius}px; box-shadow: ${look.shadow ? shadowCss(look.shadow) : "none"}; font-family: ${conceptFontStack(look.fontFamily, look.fontRef, look.fontId)}; font-size: ${look.fontSize}px; font-weight: ${look.fontWeight}; line-height: ${look.lineHeight}; padding: ${look.paddingY}px ${look.paddingX}px; }${tooltip.interactive ? `\n.${trigger} > .${bubble} { visibility: hidden; }\n.${trigger}:hover > .${bubble}, .${trigger}:focus-within > .${bubble} { visibility: visible; }` : ""}`;
  const tsx = `import { useId, type ComponentProps } from "react";\n${base}\nexport function ${name}(props: ComponentProps<typeof ${name}Base>) {\n  const tooltipId = useId();\n  return (\n    <div className="${trigger}" tabIndex={0} aria-describedby={tooltipId}>\n      <${name}Base {...props} />\n      <span className="${bubble}" id={tooltipId} role="tooltip">{${JSON.stringify(tooltip.text)}}</span>\n    </div>\n  );\n}\n`;
  const preview = `<div className="${trigger}" tabIndex={0}>\n${source.preview}\n<span className="${bubble}" role="tooltip">${escapeJsx(tooltip.text)}</span>\n</div>`;
  return { ...source, css, preview, tsx };
};
