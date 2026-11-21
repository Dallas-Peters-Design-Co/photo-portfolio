import type { ReactNode } from "react";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";

export function PageField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="page-builder__field">
      <span>{label}</span>
      {children}
    </div>
  );
}

export function PageNumber({
  label,
  value,
  onChange,
  min = 0,
  max = 12_000,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  return (
    <PageField label={label}>
      <Input
        aria-label={label}
        face="numeric"
        max={max}
        min={min}
        onChange={(e) => {
          const number = Number(e.target.value);
          if (Number.isFinite(number)) {
            onChange(Math.max(min, Math.min(max, number)));
          }
        }}
        size="sm"
        tone="board"
        type="number"
        value={value}
      />
    </PageField>
  );
}

export function PageSelect({
  label,
  value,
  options,
  onOpenChange,
  onChange,
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onOpenChange?: (open: boolean) => void;
  onChange: (value: string) => void;
}) {
  return (
    <div className="page-builder__field">
      <span>{label}</span>
      <Select
        items={options}
        onOpenChange={onOpenChange}
        onValueChange={(next) => {
          if (next !== null) {
            onChange(next);
          }
        }}
        value={value}
      >
        <SelectTrigger aria-label={label} size="sm" tone="board">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
