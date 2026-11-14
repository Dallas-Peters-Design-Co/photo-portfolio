import type { ReactNode } from "react";

/** A labelled control in the editor's context bar. */
export function Field({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is passed in as children
    <label className="creative__field">
      <span>{label}</span>
      {children}
    </label>
  );
}

/** A number typed in a field, or the fallback while it isn't one. */
export const num = (value: string, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};
