import type { BrandKitDoc } from "../../../config/brandKit.js";
import { styleSample } from "../../../config/conceptDefaults.js";
import type { ConceptStyle } from "../../../config/conceptStyle.js";
import { styleFacts, styleTitle } from "../../../config/conceptStyleFacts.js";
import { refreshPalettePaints } from "../../../config/paletteBinding.js";
import { ReviewConceptElementView } from "../review/ReviewConceptElementView";
import "../admin/ReviewConceptsEditor.css";

/** One style: drawn as it is used, beside the facts it is made of. */
function GuideComponent({
  doc,
  style,
}: {
  doc: BrandKitDoc;
  style: ConceptStyle;
}) {
  return (
    <article
      className={
        style.kind === "navbar" || style.kind === "table"
          ? "guide-component guide-component--wide"
          : "guide-component"
      }
    >
      <h3 className="guide-subhead">{styleTitle(style)}</h3>
      <div className="guide-component__sample concept-canvas">
        <ReviewConceptElementView element={styleSample(style, doc)} />
      </div>
      <dl className="guide-component__facts">
        {styleFacts(refreshPalettePaints(style, doc.palette)).map((fact) => (
          <div key={fact.label}>
            <dt>{fact.label}</dt>
            <dd>
              {fact.color ? (
                <span
                  aria-hidden
                  className="guide-component__dot"
                  style={{ background: fact.color }}
                />
              ) : null}
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

/**
 * The kit's component styles, grouped by kind (every button, then every
 * badge…), as review concepts draw them.
 */
export function ComponentSection({ doc }: { doc: BrandKitDoc }) {
  const styles = doc.componentStyles;
  if (styles.length === 0) {
    return <p className="guide-empty">No component styles yet.</p>;
  }
  const kinds = [...new Set(styles.map((style) => style.kind))];
  return (
    <div className="guide-components">
      {kinds.flatMap((kind) =>
        styles
          .filter((style) => style.kind === kind)
          .map((style) => (
            <GuideComponent doc={doc} key={style.id} style={style} />
          ))
      )}
    </div>
  );
}
