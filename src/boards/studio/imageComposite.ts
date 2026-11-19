import { svgDoc } from "./rng";
import type {
  ImageTool,
  RenderContext,
  StudioParam,
  StudioValues,
} from "./types";

const modes = [
  "normal",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "color-dodge",
  "color-burn",
  "hard-light",
  "soft-light",
  "difference",
  "exclusion",
  "hue",
  "saturation",
  "color",
  "luminosity",
];
const blend = (v: StudioValues) => modes.find((mode) => mode === v.artBlend);
const mask = (v: StudioValues) =>
  v.artMask === "alpha" || v.artMask === "luminance" ? v.artMask : null;
export const compositing = (v: StudioValues) => Boolean(blend(v) || mask(v));

const params: StudioParam[] = [
  {
    default: "none",
    key: "artBlend",
    label: "Blend over picture",
    options: [
      { label: "Off", value: "none" },
      ...modes.map((value) => ({
        label: value.charAt(0).toUpperCase() + value.slice(1).replace("-", " "),
        value,
      })),
    ],
    type: "select",
  },
  {
    default: "none",
    key: "artMask",
    label: "Mask artwork with picture",
    options: [
      { label: "Off", value: "none" },
      { label: "Transparency (alpha)", value: "alpha" },
      { label: "Brightness (luminance)", value: "luminance" },
    ],
    type: "select",
  },
];

type Picture = NonNullable<RenderContext["image"]>;
const pictures = new WeakMap<Picture, { size: string; url: string }>();

function pictureUrl(image: Picture, width: number, height: number) {
  const size = `${width}x${height}`;
  const cached = pictures.get(image);
  if (cached?.size === size) {
    return cached.url;
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext("2d");
  if (!g) {
    throw new Error("Couldn't draw the compositing picture");
  }
  const w =
    image instanceof HTMLImageElement ? image.naturalWidth : image.width;
  const h =
    image instanceof HTMLImageElement ? image.naturalHeight : image.height;
  const scale = Math.max(width / w, height / h);
  g.drawImage(
    image,
    (width - w * scale) / 2,
    (height - h * scale) / 2,
    w * scale,
    h * scale
  );
  const url = canvas.toDataURL("image/png");
  pictures.set(image, { size, url });
  return url;
}

/** Keep the generated shapes as vectors; only the chosen picture is embedded. */
export function withCompositing(tool: ImageTool): ImageTool {
  const source = tool.params.find((p) => p.type === "image");
  return {
    ...tool,
    css: tool.css
      ? (v, c) => (compositing(v) ? null : (tool.css?.(v, c) ?? null))
      : undefined,
    params: [
      ...tool.params,
      ...params,
      {
        key: "compositePicture",
        label: "Compositing picture",
        type: "image",
        when: (v) => compositing(v) && (!source || source.when?.(v) === false),
      },
    ],
    render(v, ctx) {
      if (!(ctx.image && compositing(v))) {
        return tool.render(v, ctx);
      }
      const { width, height, image } = ctx;
      const art = tool.render(
        v,
        source && source.when?.(v) !== false ? ctx : { ...ctx, image: null }
      );
      const photo = `<image width="${width}" height="${height}" href="${pictureUrl(image, width, height)}"/>`;
      const mode = blend(v);
      const channel = mask(v);
      const artwork = channel
        ? `<defs><mask id="studio-art-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}" style="mask-type:${channel}">${photo}</mask></defs><g mask="url(#studio-art-mask)">${art}</g>`
        : art;
      return svgDoc(
        width,
        height,
        mode
          ? `${photo}<g style="mix-blend-mode:${mode}">${artwork}</g>`
          : artwork
      );
    },
  };
}
