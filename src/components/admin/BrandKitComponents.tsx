import { ChevronDown, Code2, Copy, Trash2 } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { toast } from "sonner";
import type { BrandKitDoc } from "../../../config/brandKit.js";
import {
  componentSource,
  componentSourceText,
} from "../../../config/componentSource.js";
import { withIconDrawings } from "../../../config/componentSourceParts.js";
import {
  createConceptElement,
  styleSample,
} from "../../../config/conceptDefaults.js";
import type { ConceptIconSvg } from "../../../config/conceptIcon.js";
import { hasSlots } from "../../../config/conceptSlots.js";
import {
  type ConceptStyle,
  type ConceptStyleProp,
  componentPropOptionsOf,
  componentPropsOf,
  lookOf,
  MAX_CONCEPT_STYLES,
} from "../../../config/conceptStyle.js";
import { withLinkedComponents } from "../../../config/kitComponentLink.js";
import { groupKitVariants } from "../../../config/kitVariants.js";
import { newItemId } from "../../../config/proposal.js";
import {
  type ReviewConceptElement,
  type ReviewConceptElementKind,
  splitCardText,
} from "../../../config/reviewConcept.js";
import { useBrandKits } from "../../hooks/useBrandKits";
import { rememberedOpen, rememberOpen } from "../../hooks/useRememberedOpen";
import { ReviewConceptElementView } from "../review/ReviewConceptElementView";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { BrandKitVariants } from "./BrandKitVariants";
import { ComponentStyleClipboard } from "./ComponentStyleClipboard";
import {
  ConceptGroup,
  ConceptSelect,
  ELEMENT_KINDS,
  kindLabel,
} from "./ConceptControls";
import { CanvasComponentKit } from "./ReviewCanvasComponents";
import { ReviewConceptElementFields } from "./ReviewConceptElementFields";
import "./ReviewConceptsEditor.css";

const NO_LINK = "none";

const PROP_LABELS: Partial<Record<ConceptStyleProp, string>> = {
  accentColor: "Accent color",
  accordionExpanded: "Expanded by default",
  avatarInitials: "Avatar initials",
  avatarUrl: "Avatar image",
  background: "Fill",
  barHeight: "Bar height",
  body: "Card body",
  bodySize: "Body size",
  borderBottomWidth: "Bottom border width",
  borderColor: "Border color",
  borderLeftWidth: "Left border width",
  borderRightWidth: "Right border width",
  borderTopWidth: "Top border width",
  borderWidth: "Border width",
  checked: "Checked",
  checkSize: "Checkbox size",
  color: "Text color",
  direction: "Direction",
  dividers: "Dividers",
  flex: "Flex sizing",
  focus: "Focus style",
  fontFamily: "Typeface",
  fontId: "Font",
  fontRef: "Font reference",
  fontSize: "Text size",
  fontWeight: "Text weight",
  fullHeight: "Full height",
  headerBackground: "Header fill",
  headerColor: "Header text color",
  headerText: "Header text",
  hover: "Hover style",
  iconColor: "Icon color",
  iconEndName: "Trailing icon",
  iconEndSvg: "Custom trailing icon",
  iconName: "Icon",
  iconSize: "Icon size",
  iconSvg: "Custom icon",
  inputType: "Input type",
  lineHeight: "Line height",
  logoHeight: "Logo height",
  logoUrl: "Logo",
  menuLook: "Menu appearance",
  options: "Options",
  paddingX: "Horizontal padding",
  paddingY: "Vertical padding",
  panelCollapsed: "Collapsed state",
  panelToggleSide: "Toggle position",
  placeholder: "Placeholder",
  progress: "Progress value",
  radius: "Corners",
  shadow: "Shadow",
  showValue: "Show value",
  summaryIconName: "Summary icon",
  summaryIconSvg: "Custom summary icon",
  tabLook: "Tab appearance",
  tableContents: "Rows and columns",
  text: "Text",
  title: "Card title",
  titleWeight: "Title weight",
  toastAction: "Toast action",
  toastClose: "Toast close button",
  tooltip: "Tooltip",
};

const SLOT_PROP_LABEL =
  /^(header|body|footer|hide)(Layout|Alignment|Columns|Wrap|Fill|Flex|Gap|PaddingX|PaddingY)$/;
const SLOT_LABELS: Record<string, string> = {
  body: "Body",
  footer: "Footer",
  header: "Header",
  hide: "Close button",
};

const propLabel = (prop: ConceptStyleProp): string => {
  const slotProp = SLOT_PROP_LABEL.exec(prop);
  if (slotProp) {
    const [, slot, field] = slotProp;
    const label = field.replace(/([A-Z])/g, " $1").trim();
    return `${SLOT_LABELS[slot]} ${label}`;
  }
  return (
    PROP_LABELS[prop] ?? prop.replace(/[A-Z]/g, (letter) => ` ${letter}`).trim()
  );
};

/** The style as a React component and its CSS, on the clipboard. */
const copySource = async (
  sample: Parameters<typeof componentSource>[0],
  name: string
) => {
  try {
    // Icons saved by name only are drawn from the site's set, as the app
    // draws them; loaded here, on demand, like everywhere else.
    const { ICON_COMPONENTS } = await import("../../cms/iconMap");
    const source = componentSource(
      withIconDrawings(
        sample,
        (icon) => ICON_COMPONENTS[icon] as unknown as ConceptIconSvg | undefined
      ),
      name
    );
    await navigator.clipboard.writeText(componentSourceText(source));
    toast.success(`Copied ${source.name}.tsx and ${source.name}.css`);
  } catch {
    toast.error("Couldn't copy. Allow clipboard access and try again.");
  }
};

/**
 * A style's look after an edit to its sample. A panel or card keeps its items
 * too, as the starting items of every new one (ConceptStyleLook.contents).
 */
const styleLook = (
  sample: ReviewConceptElement,
  patch: Partial<ReviewConceptElement>
): ConceptStyle["look"] => {
  const next = { ...sample, ...patch };
  return {
    ...lookOf(next),
    ...(next.kind === "card" && { cardBody: splitCardText(next.text).body }),
    ...(next.kind === "table" && next.table
      ? {
          tableContents: {
            columns: next.table.columns,
            icons: next.table.icons,
            rows: next.table.rows,
          },
        }
      : {}),
    ...(next.kind === "group" && next.group
      ? { groupContents: next.group }
      : {}),
    ...(hasSlots(next.kind) && next.slots ? { contents: next.slots } : {}),
  };
};

/** One style card: name, sample and look, with actions grouped in its footer. */
function StyleEditor({
  brand,
  handle,
  onChange,
  onDuplicate,
  onRemove,
  onToggle,
  open,
  style,
}: {
  brand: BrandKitDoc;
  /** The drag handle that moves the style in the list. */
  handle: ReactNode;
  onChange: (next: ConceptStyle) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onToggle: () => void;
  open: boolean;
  style: ConceptStyle;
}) {
  const bodyId = useId();
  const sample = styleSample(style, brand);
  const editable = componentPropsOf(style);
  const changeLook = (patch: Partial<ReviewConceptElement>) =>
    onChange({ ...style, look: styleLook(sample, patch) });
  return (
    <section className="brand-kit-components__style">
      <header className="brand-kit-components__head">
        <Input
          aria-label={`${kindLabel(style.kind)} style name`}
          onChange={(event) => onChange({ ...style, name: event.target.value })}
          placeholder="Primary"
          size="sm"
          value={style.name}
        />
        <Button
          aria-controls={bodyId}
          aria-expanded={open}
          aria-label={`${open ? "Fold" : "Open"} ${kindLabel(style.kind)} ${style.name}`}
          onClick={onToggle}
          size="icon-sm"
          title={open ? "Fold component style" : "Edit component style"}
          type="button"
          variant="ghost"
        >
          <ChevronDown
            aria-hidden
            className={open ? "" : "-rotate-90"}
            size={14}
          />
        </Button>
      </header>
      {open ? (
        <div className="brand-kit-components__body" id={bodyId}>
          <div className="brand-kit-components__sample concept-canvas">
            <ReviewConceptElementView element={sample} />
          </div>
          <ReviewConceptElementFields
            brandDoc={brand}
            element={sample}
            lookOnly
            onChange={changeLook}
            styles={brand.componentStyles}
          />
          <ConceptGroup compact name="Overridable props">
            <p className="brand-kit__hint">
              Choose what can change on an instance. Slots and their contents
              stay editable.
            </p>
            {componentPropOptionsOf(style).map((prop) => {
              const id = `${bodyId}-${prop}`;
              const enabled = editable.includes(prop);
              return (
                <label
                  className="review-concepts__check"
                  htmlFor={id}
                  key={prop}
                >
                  <Checkbox
                    checked={enabled}
                    id={id}
                    onChange={(event) => {
                      const next = event.currentTarget.checked
                        ? [...editable, prop]
                        : editable.filter((key) => key !== prop);
                      onChange({ ...style, overridableProps: next });
                    }}
                  />
                  <span>{propLabel(prop)}</span>
                </label>
              );
            })}
          </ConceptGroup>
        </div>
      ) : null}
      <footer className="brand-kit-components__footer">
        {handle}
        <ComponentStyleClipboard element={sample} onChange={changeLook} />
        <Button
          aria-label={`Duplicate ${style.name}`}
          onClick={onDuplicate}
          size="icon-sm"
          title="Duplicate component style"
          type="button"
          variant="ghost"
        >
          <Copy aria-hidden size={13} />
        </Button>
        <Button
          aria-label={`Copy ${style.name} source code`}
          onClick={() => copySource(sample, style.name)}
          size="icon-sm"
          title="Copy React + CSS"
          type="button"
          variant="ghost"
        >
          <Code2 size={13} />
        </Button>
        <Button
          aria-label={`Remove ${style.name}`}
          onClick={onRemove}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <Trash2 size={13} />
        </Button>
      </footer>
    </section>
  );
}

/**
 * The kit's component styles: each styled once here, then picked by review
 * concepts, which follow it from then on (config/conceptStyle.ts).
 *
 * A sub-brand with none of its own uses its parent's, and any kit can
 * follow another kit's, drawn in its own colours and type
 * (config/kitComponentLink.ts); "Make them this brand's" copies them in to
 * change.
 */
export function BrandKitComponents({
  doc,
  effective: resolved,
  kitId,
  onChange,
}: {
  doc: BrandKitDoc;
  /** The kit as it resolves, parent included: its palette and type. */
  effective: BrandKitDoc;
  kitId: string;
  onChange: (next: BrandKitDoc) => void;
}) {
  const { kits } = useBrandKits();
  const source =
    kits.find((k) => k.id === doc.componentsFrom && k.id !== kitId) ?? null;
  const effective = withLinkedComponents(
    doc,
    resolved,
    source?.resolvedDoc ?? null
  );
  const following = Boolean(source) && doc.componentStyles.length === 0;
  const groups = groupKitVariants(doc.componentStyles);
  const styles = groups.flatMap((group) => group.variants);
  const inherited: ConceptStyle[] =
    styles.length === 0 ? effective.componentStyles : [];
  const set = (next: ConceptStyle[]) =>
    onChange({ ...doc, componentStyles: next });
  // Folded by default: the list reads as a list of styles until one is
  // opened. Which are open is remembered in this browser across reloads.
  const [open, setOpen] = useState<ReadonlySet<string>>(
    () =>
      new Set(
        [...styles, ...inherited]
          .map((style) => style.id)
          .filter((id) => rememberedOpen(`kit-style:${id}`))
      )
  );
  const toggle = (id: string) =>
    setOpen((was) => {
      const next = new Set(was);
      if (!next.delete(id)) {
        next.add(id);
      }
      rememberOpen(`kit-style:${id}`, next.has(id));
      return next;
    });

  const add = (choice: string) => {
    // Adding to a sub-brand that uses its parent's styles starts from those,
    // or every review linked to them would stop following.
    const base = styles.length === 0 ? inherited : styles;
    if (base.length >= MAX_CONCEPT_STYLES) {
      return;
    }
    const kind = choice as ReviewConceptElementKind;
    const count = base.filter((style) => style.kind === kind).length;
    const id = newItemId();
    // A new style opens, ready to style; the rest stay as they were.
    setOpen((was) => new Set(was).add(id));
    set([
      ...base,
      {
        id,
        kind,
        look: lookOf(createConceptElement(kind, effective)),
        name: count === 0 ? "Primary" : `Variant ${count + 1}`,
      },
    ]);
  };

  const duplicate = (style: ConceptStyle) => {
    if (styles.length >= MAX_CONCEPT_STYLES) {
      toast.error("The kit has reached its component style limit.");
      return;
    }
    const id = newItemId();
    const index = styles.findIndex((item) => item.id === style.id);
    const copy: ConceptStyle = {
      ...style,
      id,
      look: structuredClone(style.look),
      name: `${style.name} copy`,
    };
    setOpen((was) => new Set(was).add(id));
    set([...styles.slice(0, index + 1), copy, ...styles.slice(index + 1)]);
  };

  return (
    <div className="stack stack--snug">
      <p className="brand-kit__hint">
        Style a button, badge, card or table once. Review concepts that pick a
        style follow it, so a change here shows on every review.
      </p>
      <ConceptSelect
        label="Follow another brand's components"
        onChange={(id) =>
          onChange({ ...doc, componentsFrom: id === NO_LINK ? null : id })
        }
        options={[
          { label: "Not linked", value: NO_LINK },
          ...kits
            .filter((k) => k.id !== kitId)
            .map((k) => ({ label: k.name, value: k.id })),
        ]}
        value={doc.componentsFrom ?? NO_LINK}
      />
      {inherited.length > 0 ? (
        <p className="brand-kit__hint">
          {following && source
            ? `Following ${source.name}'s ${inherited.length} ${inherited.length === 1 ? "style" : "styles"}, in this brand's colours and type. A change there shows here.`
            : `Using the parent brand's ${inherited.length} ${inherited.length === 1 ? "style" : "styles"}.`}{" "}
          <Button
            onClick={() =>
              onChange({
                ...doc,
                componentStyles: inherited,
                componentsFrom: null,
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
      <div className="brand-kit-components__add">
        <ConceptSelect
          label="Add a component style"
          onChange={add}
          options={ELEMENT_KINDS}
          placeholder={
            styles.length >= MAX_CONCEPT_STYLES
              ? "Style limit reached"
              : "+ Add a style"
          }
          value=""
        />
      </div>
      <CanvasComponentKit.Provider value={kitId}>
        <BrandKitVariants
          groups={groups}
          onAdd={styles.length < MAX_CONCEPT_STYLES ? add : undefined}
          onReorder={set}
        >
          {(style, handle) => (
            <StyleEditor
              brand={effective}
              handle={handle}
              onChange={(next) =>
                set(styles.map((s) => (s.id === style.id ? next : s)))
              }
              onDuplicate={() => duplicate(style)}
              onRemove={() => set(styles.filter((s) => s.id !== style.id))}
              onToggle={() => toggle(style.id)}
              open={open.has(style.id)}
              style={style}
            />
          )}
        </BrandKitVariants>
      </CanvasComponentKit.Provider>
    </div>
  );
}
