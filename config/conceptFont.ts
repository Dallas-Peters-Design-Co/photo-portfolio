import { fontRefStack, parseFontRef } from "./fontRef.js";
import { findFont } from "./theme.js";

/**
 * The CSS font stack for a concept's or element's typeface choice, in one
 * place for the kit, the editor and the review page.
 *
 * Fixed stacks, not the page's own variables: "sans" used to be
 * `var(--font-sans)`, which is the admin's face in the editor and each
 * site's face on its review page, so the same element changed typeface
 * between the two.
 */
const STACKS = {
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
  sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  serif: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
} as const;

export const conceptFontStack = (
  family: string,
  fontRef?: string,
  fontId?: string
): string => {
  if (family === "app" && fontId) {
    return findFont(fontId)?.stack ?? STACKS.sans;
  }
  const ref = family === "brand" && fontRef ? parseFontRef(fontRef) : null;
  if (ref) {
    return fontRefStack(ref);
  }
  return STACKS[family as keyof typeof STACKS] ?? STACKS.sans;
};
