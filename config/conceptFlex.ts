import { bounded } from "./conceptValues.js";

/** An explicit flex item size. An omitted basis uses the item's natural size. */
export interface ConceptFlex {
  basis?: number;
  grow: number;
  shrink: number;
}

export function cleanFlex(value: unknown): { flex?: ConceptFlex } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const raw = value as Partial<ConceptFlex>;
  return {
    flex: {
      grow: bounded(raw.grow, 0, 100, 0),
      shrink: bounded(raw.shrink, 0, 100, 1),
      ...(typeof raw.basis === "number"
        ? { basis: bounded(raw.basis, 0, 12_000, 0) }
        : {}),
    },
  };
}

export const flexSize = (flex: ConceptFlex) =>
  `${flex.grow} ${flex.shrink} ${flex.basis === undefined ? "auto" : `${flex.basis}px`}`;
