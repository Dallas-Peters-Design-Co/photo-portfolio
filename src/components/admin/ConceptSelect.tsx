import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
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
