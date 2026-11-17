import type { BrandKitDoc } from "../../../config/brandKit.js";
import { useBrandKits } from "../../hooks/useBrandKits";
import { Button } from "../ui/button";
import { ConceptSelect } from "./ConceptControls";

const NO_LINK = "none";

/** The kit this one's palette follows, when it follows one. */
export const usePaletteSource = (
  doc: BrandKitDoc,
  kitId: string
): { doc: BrandKitDoc; name: string } | null => {
  const { kits } = useBrandKits();
  const kit = kits.find((k) => k.id === doc.paletteFrom && k.id !== kitId);
  return kit ? { doc: kit.resolvedDoc, name: kit.name } : null;
};

/**
 * Follow another brand's palette, as a kit can follow its components
 * (config/kitComponentLink.ts). While this kit has no colours of its own it
 * uses the other's, and a change there shows here. "Make them this brand's"
 * copies them in to change, and the link stops mattering.
 */
export function BrandKitPaletteLink({
  doc,
  kitId,
  onChange,
}: {
  doc: BrandKitDoc;
  kitId: string;
  onChange: (next: BrandKitDoc) => void;
}) {
  const { kits } = useBrandKits();
  const source = usePaletteSource(doc, kitId);
  const following = source !== null && doc.palette.length === 0;
  const count = source?.doc.palette.length ?? 0;
  return (
    <div className="stack stack--snug">
      <ConceptSelect
        label="Follow another brand's palette"
        onChange={(id) =>
          onChange({ ...doc, paletteFrom: id === NO_LINK ? null : id })
        }
        options={[
          { label: "Not linked", value: NO_LINK },
          ...kits
            .filter((k) => k.id !== kitId)
            .map((k) => ({ label: k.name, value: k.id })),
        ]}
        value={doc.paletteFrom ?? NO_LINK}
      />
      {following && source ? (
        <p className="brand-kit__hint">
          Following {source.name}'s {count} {count === 1 ? "colour" : "colours"}
          . A change there shows here.{" "}
          <Button
            onClick={() =>
              onChange({
                ...doc,
                palette: source.doc.palette,
                paletteFrom: null,
              })
            }
            size="xs"
            type="button"
            variant="outline"
          >
            Make them this brand's
          </Button>
        </p>
      ) : null}
      {source && !following ? (
        <p className="brand-kit__hint">
          This brand has colours of its own, so {source.name}'s are not used.
          Remove them to follow {source.name}.
        </p>
      ) : null}
    </div>
  );
}
