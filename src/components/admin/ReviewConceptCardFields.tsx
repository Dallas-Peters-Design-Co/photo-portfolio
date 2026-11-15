import type { BrandKitDoc } from "../../../config/brandKit.js";
import {
  type ConceptShadow,
  DEFAULT_SHADOW,
  presetOf,
  SHADOW_LIMITS,
  SHADOW_PRESETS,
  type ShadowPreset,
} from "../../../config/conceptShadow.js";
import {
  conceptIconName,
  type ReviewConceptElement,
} from "../../../config/reviewConcept.js";
import { IconPicker } from "../../cms/IconPicker";
import {
  ConceptField,
  ConceptGroup,
  ConceptSelect,
  NumberField,
} from "./ConceptControls";
import { ConceptColorField } from "./ReviewConceptBrand";

type Patch = Partial<ReviewConceptElement>;

const CUSTOM = "custom";

/** A card's icon: which one, how big, what colour. */
export function CardIconGroup({
  brandDoc,
  element,
  onChange,
}: {
  brandDoc?: BrandKitDoc | null;
  element: ReviewConceptElement;
  onChange: (patch: Patch) => void;
}) {
  return (
    <ConceptGroup name="Icon">
      <ConceptField label="Icon" wide>
        <IconPicker
          label="Card icon"
          onChange={(icon) => onChange({ iconName: icon ?? undefined })}
          size="sm"
          value={conceptIconName(element.iconName)}
        />
      </ConceptField>
      {element.iconName ? (
        <>
          <NumberField
            label="Icon size"
            max={96}
            onChange={(iconSize) => onChange({ iconSize })}
            value={element.iconSize ?? Math.round(element.fontSize * 1.5)}
          />
          <ConceptColorField
            ariaLabel="card icon color"
            brandDoc={brandDoc}
            label="Icon color"
            onChange={(iconColor) => onChange({ iconColor })}
            value={element.iconColor ?? element.color}
          />
        </>
      ) : null}
    </ConceptGroup>
  );
}

const SHADOW_FIELDS = [
  ["x", "X"],
  ["y", "Y"],
  ["blur", "Blur"],
  ["spread", "Spread"],
  ["opacity", "Opacity %"],
] as const;

/**
 * A preset to start from, then every part of the shadow. Tuning any field
 * turns the preset to Custom.
 */
export function CardShadowGroup({
  brandDoc,
  element,
  onChange,
}: {
  brandDoc?: BrandKitDoc | null;
  element: ReviewConceptElement;
  onChange: (patch: Patch) => void;
}) {
  const shadow = element.shadow ?? DEFAULT_SHADOW;
  const preset = presetOf(shadow);
  const set = (patch: Partial<ConceptShadow>) =>
    onChange({ shadow: { ...shadow, ...patch } });
  return (
    <ConceptGroup name="Shadow">
      <ConceptField label="Preset">
        <ConceptSelect
          label="Shadow preset"
          onChange={(name) => {
            if (name !== CUSTOM) {
              onChange({ shadow: SHADOW_PRESETS[name as ShadowPreset] });
            }
          }}
          options={[
            { label: "None", value: "none" },
            { label: "Soft", value: "soft" },
            { label: "Strong", value: "strong" },
            { disabled: true, label: "Custom", value: CUSTOM },
          ]}
          value={preset ?? CUSTOM}
        />
      </ConceptField>
      {SHADOW_FIELDS.map(([key, label]) => (
        <NumberField
          key={key}
          label={label}
          max={SHADOW_LIMITS[key][1]}
          min={SHADOW_LIMITS[key][0]}
          onChange={(value) => set({ [key]: value })}
          value={shadow[key]}
        />
      ))}
      <ConceptColorField
        ariaLabel="card shadow color"
        brandDoc={brandDoc}
        label="Color"
        onChange={(color) => set({ color })}
        value={shadow.color}
      />
    </ConceptGroup>
  );
}
