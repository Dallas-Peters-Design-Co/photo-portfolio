import { Copy, Plus, Save, Type } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  MAX_TYPEFACES,
  type TypefaceEntry,
} from "../../../../config/brandKit.js";
import {
  modularScale,
  scaleCss,
  spacingSteps,
  type TypeScale,
} from "../../../../config/typeScale.js";
import { facesFor } from "../../../components/typeScale/faces";
import { TypeScaleEditor } from "../../../components/typeScale/TypeScaleEditor";
import { useKitPalette } from "../color/useKitPalette";
import type { StudioComposition } from "../composition";
import { FacePicker } from "./FacePicker";
import { typeSpecimen } from "./specimen";

type Role = "body" | "headline";

/**
 * The kit's typefaces with the faces picked here put first in their roles,
 * so the kit reads them as its headline and body faces. Nothing already in
 * the kit is removed.
 */
const withPicked = (
  typefaces: TypefaceEntry[],
  picked: Partial<Record<Role, TypefaceEntry>>
): TypefaceEntry[] => {
  const chosen = [picked.headline, picked.body].filter(
    (f): f is TypefaceEntry => Boolean(f)
  );
  const refs = new Set(chosen.map((f) => f.ref ?? f.name));
  return [
    ...chosen,
    ...typefaces.filter((f) => !refs.has(f.ref ?? f.name)),
  ].slice(0, MAX_TYPEFACES);
};

/**
 * Type & Spacing Scale, after Design System Studio: the brand's text styles
 * and spacing steps, edited against the brand's own fonts, saved to the kit
 * (and so to DESIGN.md and the brand guide), copied as CSS, or put on the
 * board as a specimen.
 */
export function TypeScaleTool({
  onAdd,
  onApply,
}: {
  onAdd?: (composition: StudioComposition) => void;
  /** Working for a frame: restyle its text with this scale. */
  onApply?: (scale: TypeScale) => void;
}) {
  const { kit, saving, update } = useKitPalette();
  const typefaces = kit?.resolvedDoc.typefaces ?? [];
  // Faces picked here, over the kit's own until saved.
  const [picked, setPicked] = useState<Partial<Record<Role, TypefaceEntry>>>(
    {}
  );
  const faces = { ...facesFor(typefaces), ...picked };
  const pick = (role: Role) => (face: TypefaceEntry) =>
    setPicked((p) => ({ ...p, [role]: face }));
  const [scale, setScale] = useState<TypeScale | null>(
    () =>
      kit?.resolvedDoc.typeScale ?? {
        spacing: spacingSteps(8),
        styles: modularScale({
          base: 16,
          headWeight: faces.headline?.weights.length
            ? Math.max(...faces.headline.weights)
            : 700,
          ratio: 1.25,
        }),
      }
  );

  const add = () => {
    if (!(scale && onAdd)) {
      return;
    }
    onAdd(
      typeSpecimen(scale, faces, kit?.name ?? "Brand", kit?.resolvedDoc.palette)
    );
    toast.success("Editable type scale added");
  };

  return (
    <>
      <FacePicker
        face="headline"
        kitFaces={typefaces}
        label="Headline"
        onChange={pick("headline")}
        value={faces.headline}
      />
      <FacePicker
        face="body"
        kitFaces={typefaces}
        label="Body"
        onChange={pick("body")}
        value={faces.body}
      />
      <TypeScaleEditor
        faces={faces}
        onChange={setScale}
        scan={kit?.resolvedDoc.scans[0]}
        value={scale}
      />
      <p className="studio__blurb">
        Pick headline and body faces from the kit, Google Fonts, or Fontshare.
        Saving writes the scale, and the faces picked here, into the kit's
        DESIGN.md and brand guide.
      </p>
      <div className="studio__actions">
        {onApply ? (
          <button
            className="studio__button studio__button--primary"
            disabled={!scale?.styles.length}
            onClick={() => {
              if (scale) {
                onApply(scale);
                toast.success("Type scale applied to the frame's text");
              }
            }}
            title="Headline takes h1, body copy takes body, the button takes label"
            type="button"
          >
            <Type size={14} /> Apply to frame
          </button>
        ) : null}
        {kit ? (
          <button
            className="studio__button studio__button--primary"
            disabled={saving}
            onClick={() => {
              const changed = Object.keys(picked).length > 0;
              void update(
                changed
                  ? {
                      typefaces: withPicked(typefaces, picked),
                      typeScale: scale,
                    }
                  : { typeScale: scale },
                "type scale"
              ).then((saved) => {
                // Saved, the kit's faces are the picked ones.
                if (saved) {
                  setPicked({});
                }
              });
            }}
            type="button"
          >
            <Save size={14} /> Save to {kit.name}
          </button>
        ) : null}
        <button
          className="studio__button"
          disabled={!(scale?.styles.length && onAdd)}
          onClick={add}
          type="button"
        >
          <Plus size={14} /> Add editable frame
        </button>
        <button
          className="studio__button"
          disabled={!scale}
          onClick={() => {
            if (scale) {
              void navigator.clipboard?.writeText(scaleCss(scale));
              toast.success("CSS copied");
            }
          }}
          type="button"
        >
          <Copy size={14} /> CSS
        </button>
      </div>
    </>
  );
}
