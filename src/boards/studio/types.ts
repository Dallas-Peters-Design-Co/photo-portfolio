/**
 * The Studio: small generators for backgrounds, patterns, shapes and
 * colour, each a pure function of its settings and the brand's palette.
 *
 * An image tool is a schema of settings plus `render`, which returns an SVG
 * string for the size asked. The panel draws the controls from the schema,
 * previews the SVG, and turns it into a PNG or SVG file for the board.
 */

export type StudioParam =
  | {
      default: number;
      key: string;
      label: string;
      max: number;
      min: number;
      step?: number;
      type: "range";
    }
  | {
      default: string;
      key: string;
      label: string;
      options: { label: string; value: string }[];
      type: "select";
    }
  | { default: string; key: string; label: string; type: "color" }
  | { default: boolean; key: string; label: string; type: "checkbox" }
  | { key: string; label: string; type: "seed" }
  | { key: string; label: string; type: "image" }
  /**
   * The colours a tool draws with, picked one by one. Stored comma-joined;
   * empty means the brand's first `count`. Replaces the palette the tool sees.
   */
  | { count: number; key: string; label: string; max: number; type: "colors" };

export type StudioValues = Record<string, boolean | number | string | null>;

export interface RenderContext {
  height: number;
  /** For tools that read a picture (Mosaic): the image, already decoded. */
  image: HTMLImageElement | ImageBitmap | null;
  /** The active brand's colours, or a neutral default set. */
  palette: string[];
  width: number;
}

export interface ImageTool {
  blurb: string;
  /** Plain-text CSS for the result, for tools where that is meaningful. */
  css?: (values: StudioValues, ctx: RenderContext) => string | null;
  id: string;
  kind: "image";
  name: string;
  params: StudioParam[];
  /** An SVG document for the size asked. Deterministic for a given seed. */
  render: (values: StudioValues, ctx: RenderContext) => string;
}
