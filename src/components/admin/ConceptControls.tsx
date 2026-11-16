import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { ReviewConceptElementKind } from "../../../config/reviewConcept.js";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

export interface ConceptOption {
  disabled?: boolean;
  label: string;
  value: string;
}

export interface ConceptOptionGroup {
  label?: string;
  options: ConceptOption[];
}

/** Builds options from `[value, label]` pairs, the shape most menus need. */
export const optionsOf = (
  pairs: readonly (readonly [string, string])[]
): ConceptOption[] => pairs.map(([value, label]) => ({ label, value }));

/**
 * Every menu in the concept editor: the project Select at its small size, so
 * each control in a row is the same height. An empty value shows the
 * placeholder.
 */
export function ConceptSelect({
  groups,
  label,
  onChange,
  options = [],
  placeholder,
  value,
}: {
  groups?: ConceptOptionGroup[];
  label: string;
  onChange: (value: string) => void;
  options?: ConceptOption[];
  placeholder?: string;
  value: string;
}) {
  const all = groups ?? [{ options }];
  const items = Object.fromEntries(
    all.flatMap((group) => group.options.map((o) => [o.value, o.label]))
  );
  return (
    <Select
      items={items}
      onValueChange={(next: string | null) => {
        if (next !== null) {
          onChange(next);
        }
      }}
      value={value === "" ? null : value}
    >
      <SelectTrigger aria-label={label} size="sm">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {all.map((group, index) => (
          <SelectGroup key={group.label ?? index}>
            {group.label ? <SelectLabel>{group.label}</SelectLabel> : null}
            {group.options.map((option) => (
              <SelectItem
                disabled={option.disabled}
                key={option.value}
                value={option.value}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

/** A caption over a control. A div, not a label: the Select names itself. */
export function ConceptField({
  children,
  label,
  wide = false,
}: {
  children: ReactNode;
  label: string;
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        "review-concepts__field",
        wide && "review-concepts__field--wide"
      )}
    >
      <span>{label}</span>
      {children}
    </div>
  );
}

export function NumberField({
  label,
  max,
  min = 0,
  onChange,
  step = 1,
  value,
}: {
  label: string;
  max: number;
  min?: number;
  onChange: (value: number) => void;
  step?: number;
  value: number;
}) {
  return (
    <ConceptField label={label}>
      <Input
        aria-label={label}
        face="numeric"
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        size="sm"
        step={step}
        type="number"
        value={value}
      />
    </ConceptField>
  );
}

/** One named row of the element form: Content, Icon, Type, Box, Shadow, Color. */
export function ConceptGroup({
  children,
  name,
}: {
  children: ReactNode;
  name: string;
}) {
  return (
    <div className="review-concepts__group">
      <span className="review-concepts__group-name">{name}</span>
      <div className="review-concepts__group-fields">{children}</div>
    </div>
  );
}

/** The element types, as the add menus list them. */
export const ELEMENT_KINDS = optionsOf([
  ["text", "Text"],
  ["icon", "Icon"],
  ["button", "Button"],
  ["input", "Input"],
  ["textarea", "Text area"],
  ["select", "Select"],
  ["checkbox", "Checkbox"],
  ["card", "Card"],
  ["label", "Label"],
  ["badge", "Badge"],
  ["link", "Link"],
  ["divider", "Divider"],
  ["tabs", "Tabs"],
  ["table", "Table"],
  ["dialog", "Dialog"],
  ["menu", "Dropdown menu"],
  ["toast", "Toast"],
  ["skeleton", "Skeleton loader"],
  ["progress", "Progress bar"],
]);

/** A kind's menu label ("Dropdown menu" for menu), or the kind itself. */
export const kindLabel = (kind: ReviewConceptElementKind): string =>
  ELEMENT_KINDS.find((option) => option.value === kind)?.label ?? kind;
