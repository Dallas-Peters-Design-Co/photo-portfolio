/** What scanColors and scanLogo read off a rendered page (see scanBrand.mjs). */
export declare function scanColors(
  win?: Window,
  extraCss?: string
): { name: string; role: string; uses: number; value: string }[];

export declare function scanLogo(
  win?: Window
):
  | { alt: string; kind: "img"; src: string }
  | { alt: string; kind: "svg"; svg: string }
  | null;
