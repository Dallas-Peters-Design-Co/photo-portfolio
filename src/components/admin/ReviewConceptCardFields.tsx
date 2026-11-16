import { useId } from "react";
import type { BrandKitDoc } from "../../../config/brandKit.js";
import type { ConceptHover } from "../../../config/conceptHover.js";
import {
  type ConceptIconSvg,
  conceptIconName,
} from "../../../config/conceptIcon.js";
import { iconSizeOf, takesIcon } from "../../../config/conceptKinds.js";
import {
  type ConceptShadow,
  presetOf,
  SHADOW_LIMITS,
  SHADOW_PRESETS,
  type ShadowPreset,
  shadowOf,
} from "../../../config/conceptShadow.js";
import {
  type ConceptTabLook,
  TAB_LIMITS,
} from "../../../config/conceptTabs.js";
import type { ReviewConceptElement } from "../../../config/reviewConcept.js";
import { IconPicker } from "../../cms/IconPicker";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import {
  ConceptField,
  ConceptGroup,
  ConceptSelect,
  NumberField,
} from "./ConceptControls";
import { ConceptColorField } from "./ReviewConceptBrand";

type Patch = Partial<ReviewConceptElement>;

const CUSTOM = "custom";

/** The optional icon of a card or an input: which one, how big, what colour. */
export function ElementIconGroup({
  brandDoc,
  element,
  lookOnly = false,
  onChange,
}: {
  brandDoc?: BrandKitDoc | null;
  element: ReviewConceptElement;
  /** A kit style: its icon's size and colour are set even without an icon. */
  lookOnly?: boolean;
  onChange: (patch: Patch) => void;
}) {
  const kind = element.kind[0]?.toUpperCase() + element.kind.slice(1);
  return (
    <ConceptGroup name="Icon">
      <ConceptField label="Icon" wide>
        <IconPicker
          label={`${kind} icon`}
          library="full"
          onChange={(icon, svg) =>
            onChange({
              iconName: icon ?? undefined,
              iconSvg: svg as ConceptIconSvg | undefined,
            })
          }
          size="sm"
          svg={element.iconSvg}
          value={conceptIconName(element.iconName)}
        />
      </ConceptField>
      {element.iconName || lookOnly ? (
        <>
          <NumberField
            label="Icon size"
            max={96}
            onChange={(iconSize) => onChange({ iconSize })}
            value={iconSizeOf(element)}
          />
          <ConceptColorField
            ariaLabel={`${element.kind} icon color`}
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
export function ShadowGroup({
  brandDoc,
  element,
  onChange,
}: {
  brandDoc?: BrandKitDoc | null;
  element: ReviewConceptElement;
  onChange: (patch: Patch) => void;
}) {
  const shadow = shadowOf(element);
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

/** A checkbox's box: its checked colour and its size. */
export function CheckboxGroup({
  brandDoc,
  element,
  onChange,
}: {
  brandDoc?: BrandKitDoc | null;
  element: ReviewConceptElement;
  onChange: (patch: Patch) => void;
}) {
  return (
    <ConceptGroup name="Checkbox">
      <ConceptColorField
        ariaLabel="checkbox accent color"
        brandDoc={brandDoc}
        label="Accent"
        onChange={(accentColor) => onChange({ accentColor })}
        value={element.accentColor ?? "#3538cd"}
      />
      <NumberField
        label="Box size"
        max={40}
        min={10}
        onChange={(checkSize) => onChange({ checkSize })}
        value={element.checkSize ?? 16}
      />
    </ConceptGroup>
  );
}

/** Tabs: the active tab's indicator and colour, the others' colour, height. */
export function TabsGroup({
  brandDoc,
  element,
  onChange,
}: {
  brandDoc?: BrandKitDoc | null;
  element: ReviewConceptElement;
  onChange: (patch: Patch) => void;
}) {
  const look = element.tabLook ?? {};
  const set = (patch: ConceptTabLook) =>
    onChange({ tabLook: { ...look, ...patch } });
  return (
    <ConceptGroup name="Tabs">
      <ConceptColorField
        ariaLabel="tabs indicator color"
        brandDoc={brandDoc}
        label="Indicator"
        onChange={(indicatorColor) => set({ indicatorColor })}
        value={look.indicatorColor ?? element.color}
      />
      <NumberField
        label="Indicator size"
        max={TAB_LIMITS.indicatorSize[1]}
        min={TAB_LIMITS.indicatorSize[0]}
        onChange={(indicatorSize) => set({ indicatorSize })}
        value={look.indicatorSize ?? 2}
      />
      <ConceptColorField
        ariaLabel="active tab color"
        brandDoc={brandDoc}
        label="Active"
        onChange={(activeColor) => set({ activeColor })}
        value={look.activeColor ?? element.color}
      />
      <ConceptColorField
        ariaLabel="inactive tab color"
        brandDoc={brandDoc}
        label="Inactive"
        onChange={(inactiveColor) => set({ inactiveColor })}
        value={look.inactiveColor ?? element.color}
      />
      <NumberField
        label="Height"
        max={TAB_LIMITS.height[1]}
        min={TAB_LIMITS.height[0]}
        onChange={(height) => set({ height })}
        value={look.height ?? 40}
      />
    </ConceptGroup>
  );
}

/** A toast's action (label and colour; none when empty) and its close button. */
export function ToastGroup({
  brandDoc,
  element,
  onChange,
}: {
  brandDoc?: BrandKitDoc | null;
  element: ReviewConceptElement;
  onChange: (patch: Patch) => void;
}) {
  const closeId = useId();
  return (
    <ConceptGroup name="Toast">
      <ConceptField label="Action">
        <Input
          aria-label="Toast action"
          onChange={(event) => onChange({ toastAction: event.target.value })}
          placeholder="None"
          size="sm"
          value={element.toastAction ?? ""}
        />
      </ConceptField>
      <ConceptColorField
        ariaLabel="toast action color"
        brandDoc={brandDoc}
        label="Action color"
        onChange={(accentColor) => onChange({ accentColor })}
        value={element.accentColor ?? element.color}
      />
      <label className="review-concepts__check" htmlFor={closeId}>
        <Checkbox
          checked={element.toastClose !== false}
          id={closeId}
          onChange={(event) => onChange({ toastClose: event.target.checked })}
        />
        <span>Close button</span>
      </label>
    </ConceptGroup>
  );
}

const HOVER_SHADOWS = [
  { label: "Same", value: "same" },
  { label: "None", value: "none" },
  { label: "Soft", value: "soft" },
  { label: "Strong", value: "strong" },
];

/**
 * How the element changes under the pointer. "None" leaves a colour as it
 * is; a tab row offers only the text colour, for the tabs not selected.
 */
export function HoverGroup({
  brandDoc,
  element,
  onChange,
}: {
  brandDoc?: BrandKitDoc | null;
  element: ReviewConceptElement;
  onChange: (patch: Patch) => void;
}) {
  const hover = element.hover ?? {};
  const set = (patch: Partial<ConceptHover>) => {
    const next = Object.fromEntries(
      Object.entries({ ...hover, ...patch }).filter(
        ([, value]) => value !== undefined && value !== "transparent"
      )
    ) as ConceptHover;
    onChange({ hover: Object.keys(next).length > 0 ? next : undefined });
  };
  const color = (
    key: "background" | "borderColor" | "color" | "iconColor",
    label: string
  ) => (
    <ConceptColorField
      allowNone
      ariaLabel={`hover ${label.toLowerCase()}`}
      brandDoc={brandDoc}
      label={label}
      onChange={(value) => set({ [key]: value })}
      value={hover[key] ?? "transparent"}
    />
  );
  if (element.kind === "tabs") {
    return <ConceptGroup name="Hover">{color("color", "Text")}</ConceptGroup>;
  }
  return (
    <ConceptGroup name="Hover">
      {color("background", "Fill")}
      {color("color", "Text")}
      {color("borderColor", "Border")}
      {takesIcon(element.kind) ? color("iconColor", "Icon") : null}
      <ConceptField label="Shadow">
        <ConceptSelect
          label="Hover shadow"
          onChange={(name) =>
            set({
              shadow:
                name === "same"
                  ? undefined
                  : SHADOW_PRESETS[name as ShadowPreset],
            })
          }
          options={HOVER_SHADOWS}
          value={(hover.shadow && presetOf(hover.shadow)) ?? "same"}
        />
      </ConceptField>
    </ConceptGroup>
  );
}
