/** Small pieces of HTML writing shared by the HTML5 and print exports. */

export const escapeHtml = (s: string): string =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export const px = (n: number) => `${Math.round(n * 100) / 100}px`;

export const styleOf = (
  rules: Record<string, string | null | undefined>
): string =>
  Object.entries(rules)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
