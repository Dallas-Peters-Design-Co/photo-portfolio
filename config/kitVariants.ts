import type { ConceptStyle } from "./conceptStyle.js";

export function groupKitVariants(styles: ConceptStyle[]) {
  const byKind = new Map<ConceptStyle["kind"], ConceptStyle[]>();
  for (const style of styles) {
    const variants = byKind.get(style.kind);
    if (variants) {
      variants.push(style);
    } else {
      byKind.set(style.kind, [style]);
    }
  }
  return Array.from(byKind, ([id, variants]) => ({ id, variants }));
}
