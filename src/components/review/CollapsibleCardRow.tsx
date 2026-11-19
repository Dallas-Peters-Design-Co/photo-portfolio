import type { ReactNode } from "react";

export function CollapsibleCardRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <details className="concept-group__disclosure" open>
      <summary>{label}</summary>
      {children}
    </details>
  );
}
