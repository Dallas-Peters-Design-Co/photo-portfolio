import { Copy, Plus, Save, Type } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { familyOf } from "../../../../config/designMd.js";
import {
  modularScale,
  scaleCss,
  spacingSteps,
  type TypeScale,
} from "../../../../config/typeScale.js";
import { facesFor } from "../../../components/typeScale/faces";
import { TypeScaleEditor } from "../../../components/typeScale/TypeScaleEditor";
import { useKitPalette } from "../color/useKitPalette";
import { specimenPng } from "./specimen";

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
  onAdd: (file: File) => void;
  /** Working for a frame: restyle its text with this scale. */
  onApply?: (scale: TypeScale) => void;
}) {
  const { kit, saving, update } = useKitPalette();
  const typefaces = kit?.resolvedDoc.typefaces ?? [];
  const faces = facesFor(typefaces);
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

  const add = async () => {
    if (!scale) {
      return;
    }
    try {
      const png = await specimenPng(
        scale,
        (face) => {
          const f = face === "headline" ? faces.headline : faces.body;
          return f ? `"${familyOf(f)}"` : undefined;
        },
        kit?.name ?? "Brand"
      );
      onAdd(new File([png], "type-scale.png", { type: "image/png" }));
      toast.success("Type specimen added to the board");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't draw it");
    }
  };

  return (
    <>
      <TypeScaleEditor
        faces={faces}
        onChange={setScale}
        scan={kit?.resolvedDoc.scans[0]}
        value={scale}
      />
      <p className="studio__blurb">
        {typefaces.length > 0
          ? "Set in the kit's headline and body faces."
          : "The kit has no typefaces yet, so this previews in the system font."}{" "}
        Saving writes the scale into the kit's DESIGN.md and brand guide.
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
            onClick={() => void update({ typeScale: scale }, "type scale")}
            type="button"
          >
            <Save size={14} /> Save to {kit.name}
          </button>
        ) : null}
        <button
          className="studio__button"
          disabled={!scale?.styles.length}
          onClick={() => void add()}
          type="button"
        >
          <Plus size={14} /> Add to board
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
