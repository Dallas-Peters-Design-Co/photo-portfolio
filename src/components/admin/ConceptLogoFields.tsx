import type { BrandKitDoc } from "../../../config/brandKit.js";
import type { ReviewConceptElement } from "../../../config/reviewConcept.js";
import { ConceptGroup, NumberField } from "./ConceptControls";

/**
 * A logo element's settings: which of the brand kit's logos it shows, and
 * how high. The picture is the kit's own, so a logo changed in the kit (or
 * redrawn from its component) is picked again here.
 */
export function LogoGroup({
  brandDoc,
  element,
  onChange,
  showHeight = true,
  showLogo = true,
}: {
  brandDoc?: BrandKitDoc | null;
  element: ReviewConceptElement;
  onChange: (patch: Partial<ReviewConceptElement>) => void;
  showHeight?: boolean;
  showLogo?: boolean;
}) {
  const logos = brandDoc?.logos ?? [];
  return (
    <ConceptGroup name="Logo">
      {showLogo && logos.length > 0 ? (
        <div className="review-concepts__logos">
          {logos.map((logo) => (
            <button
              aria-label={`Use ${logo.label || "this logo"}`}
              aria-pressed={element.logoUrl === logo.url}
              className="review-concepts__logo-choice"
              key={logo.url}
              onClick={() => onChange({ logoUrl: logo.url })}
              title={logo.label}
              type="button"
            >
              <img alt="" height={28} src={logo.url} width={84} />
            </button>
          ))}
        </div>
      ) : null}
      {showLogo && logos.length === 0 ? (
        <p className="review-concepts__hint">
          Add a logo to the brand kit to show it here.
        </p>
      ) : null}
      {showHeight ? (
        <NumberField
          label="Height"
          max={160}
          min={12}
          onChange={(logoHeight) => onChange({ logoHeight })}
          value={element.logoHeight ?? 32}
        />
      ) : null}
    </ConceptGroup>
  );
}
